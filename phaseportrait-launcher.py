try:
    from phaseportrait import PhasePortrait2DManager
except ImportError:
    from phaseportrait_local.phaseportrait import PhasePortrait2DManager
    from phaseportrait_local.phaseportrait import PhasePortrait2D

import io
import json
import mimetypes
from pathlib import Path
from sys import argv

try:
    import tornado
except ImportError as err:
    raise RuntimeError("This example requires tornado.") from err
import matplotlib as mpl
import numpy as np
import tornado.httpserver
import tornado.ioloop
import tornado.web
import tornado.websocket
from matplotlib.backends.backend_webagg_core import (
    FigureManagerWebAgg, new_figure_manager_given_figure)

# This html is used in the tornado local server with the figure
html_content = """
<html>
  <head>
    <link rel="stylesheet" href="_static/css/page.css" type="text/css">
    <link rel="stylesheet" href="_static/css/boilerplate.css"
          type="text/css" />
    <link rel="stylesheet" href="_static/css/fbm.css" type="text/css" />
    <link rel="stylesheet" href="_static/css/mpl.css" type="text/css">
    <script src="mpl.js"></script>
    <script>
      /* This is a callback that is called when the user saves
         (downloads) a file.  Its purpose is really to map from a
         figure and file format to a url in the application. */
      function ondownload(figure, format) {
        window.open('download.' + format, '_blank');
      };
      function ready(fn) {
        if (document.readyState != "loading") {
          fn();
        } else {
          document.addEventListener("DOMContentLoaded", fn);
        }
      }
      ready(
        function() {
          /* It is up to the application to provide a websocket that the figure
             will use to communicate to the server.  This websocket object can
             also be a "fake" websocket that underneath multiplexes messages
             from multiple figures, if necessary. */
          var websocket_type = mpl.get_websocket_type();
          var websocket = new websocket_type("%(ws_uri)sws");
          // mpl.figure creates a new figure on the webpage.
          var fig = new mpl.figure(
              // A unique numeric identifier for the figure
              %(fig_id)s,
              // A websocket object (or something that behaves like one)
              websocket,
              // A function called when a file type is selected for download
              ondownload,
              // The HTML element in which to place the figure
              document.getElementById("figure"));
        }
      );
    </script>
    <title>matplotlib</title>
  </head>
  <body>
    <div id="figure">
    </div>
  </body>
</html>
"""


class PhasePortraitServer(tornado.web.Application):
    class MainPage(tornado.web.RequestHandler):
        """
        Serves the main HTML page.
        """

        def get(self):
            manager = self.application.manager
            ws_uri = "ws://{req.host}/".format(req=self.request)
            content = html_content % {
                "ws_uri": ws_uri, "fig_id": manager.num}
            self.write(content)

    class MplJs(tornado.web.RequestHandler):
        """
        Serves the generated matplotlib javascript file.  The content
        is dynamically generated based on which toolbar functions the
        user has defined.  Call `FigureManagerWebAgg` to get its
        content.
        """

        def get(self):
            self.set_header('Content-Type', 'application/javascript')
            js_content = FigureManagerWebAgg.get_javascript()

            self.write(js_content)

    class Download(tornado.web.RequestHandler):
        """
        Handles downloading of the figure in various file formats.
        """

        def get(self, fmt):
            manager = self.application.manager
            self.set_header(
                'Content-Type', mimetypes.types_map.get(fmt, 'binary'))
            buff = io.BytesIO()
            manager.canvas.figure.savefig(buff, format=fmt)
            self.write(buff.getvalue())

    class WebSocket(tornado.websocket.WebSocketHandler):
        """
        A websocket for interactive communication between the plot in
        the browser and the server.
        In addition to the methods required by tornado, it is required to
        have two callback methods:
            - ``send_json(json_content)`` is called by matplotlib when
              it needs to send json to the browser.  `json_content` is
              a JSON tree (Python dictionary), and it is the responsibility
              of this implementation to encode it as a string to send over
              the socket.
            - ``send_binary(blob)`` is called to send binary image data
              to the browser.
        """
        supports_binary = True

        def open(self):
            # Register the websocket with the FigureManager.
            manager = self.application.manager
            manager.add_web_socket(self)
            if hasattr(self, 'set_nodelay'):
                self.set_nodelay(True)

        def on_close(self):
            # When the socket is closed, deregister the websocket with
            # the FigureManager.
            manager = self.application.manager
            manager.remove_web_socket(self)

        def on_message(self, message):
            # The 'supports_binary' message is relevant to the
            # websocket itself.  The other messages get passed along
            # to matplotlib as-is.

            # Every message has a "type" and a "figure_id".
            message = json.loads(message)
            if message['type'] == 'supports_binary':
                self.supports_binary = message['value']
            else:
                manager = self.application.manager
                manager.handle_json(message)

        def send_json(self, content):
            self.write_message(json.dumps(content))

        def send_binary(self, blob):
            if self.supports_binary:
                self.write_message(blob, binary=True)
            else:
                data_uri = "data:image/png;base64,{0}".format(
                    blob.encode('base64').replace('\n', ''))
                self.write_message(data_uri)
                
          
    # TODO: este debería ser el websocket que relaciona electron con python      
    class PPSocket(tornado.websocket.WebSocketHandler):
        def open(self):
            print("open")

        def on_close(self):
            print("close")

        def on_message(self, message):
            message = json.loads(message)
            result = self.application.phaseportriat.manager.handle_json(message)
            self.write_message(str(result))
            

    def __init__(self):
        self.phaseportrait = PhasePortrait2D(lambda x,y: (y,-x), [[0,1], [0,1]])
        self.phaseportrait.plot()
        
        self.figure = self.phaseportrait.fig
        self.manager = new_figure_manager_given_figure(id(self.figure), self.figure)

        super().__init__([
            # Static files for the CSS and JS
            (r'/_static/(.*)',
             tornado.web.StaticFileHandler,
             {'path': FigureManagerWebAgg.get_static_file_path()}),

            # Static images for the toolbar
            (r'/_images/(.*)',
             tornado.web.StaticFileHandler,
             {'path': Path(mpl.get_data_path(), 'images')}),

            # The page that contains all of the pieces
            ('/', self.MainPage),

            ('/mpl.js', self.MplJs),

            # Sends images and events to the browser, and receives
            # events from the browser
            ('/ws', self.WebSocket),

            # Handles the downloading (i.e., saving) of static images
            (r'/download.([a-z0-9.]+)', self.Download),
            
            # TODO: este es el nuestro, para nosotros. Creo que se hace así
            (r'/pp', self.PPSocket),
        ])

if __name__ == '__main__':

    # modes = {
    #     '--code' : PhasePortrait2DManager.json_to_python_code,
    #     '--plot' : PhasePortrait2DManager.plot_from_json
    # }
    # result = modes[argv[1]](argv[2])
    
   
    
    with open("log_py.txt", 'w') as file:
        try:
            application = PhasePortraitServer()
            http_server = tornado.httpserver.HTTPServer(application)
            http_server.listen(8080)

            print("http://localhost:8080/")
            tornado.ioloop.IOLoop.current().start()
        except Exception as e:
            file.write(e)
