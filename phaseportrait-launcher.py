try:
    from phaseportrait import PhasePortrait2DManager
except ImportError:
    from phaseportrait_local.phaseportrait import PhasePortrait2D
except ModuleNotFoundError:
    from phaseportrait_local.phaseportrait import PhasePortrait2D

import io
import os
import json
import mimetypes
from pathlib import Path

from matplotlib import pyplot as plt


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

files_path = '/'.join(__file__.split('\\')[:-1])


class Logger:
    def __init__(self):
        self.log_file = open("log.txt", 'a')
    
    def __call__(self, message):
        self.log_file.write(message)
    
    def __del__(self):
        self.log_file.close()

class PhasePortraitServer(tornado.web.Application):
    class MainPage(tornado.web.RequestHandler):
        """
        Serves the main HTML page.
        """

        def get(self):
            manager = self.application.manager
            html_content = open(os.path.join(os.path.dirname(__file__), 'plot.html'), 'r').read()
            ws_uri = "ws://{req.host}/".format(req=self.request)
            content = html_content \
                .replace('%(files_path)', files_path) \
                .replace('%(ws_uri)', ws_uri) \
                .replace('%(fig_id)', str(manager.num))
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
            js_content = open(os.path.join(os.path.dirname(__file__), 'web_backend\\js\\mpl.js'), 'r').read()
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
        _prev_ = None
        logger = Logger()

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
                
                if message['type'] == 'button_release' or \
                    (self._prev_ == 'home'):
                    ax = self.application.phaseportrait.ax
                    x_lim = ax.get_xlim()
                    y_lim = ax.get_ylim()
                    ax.cla()
                    self.application.phaseportrait.Range = [x_lim, y_lim]
                    try:
                        self.application.phaseportrait.plot()
                    except Exception as e:
                        self.logger(e)
                self._prev_ = message.get('name', None)
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
        logger = Logger()
        
        def open(self):
            # manager = self.application.manager
            # manager.add_web_socket(self)

            if hasattr(self, 'set_nodelay'):
                self.set_nodelay(True)

        def on_close(self):
            # manager = self.application.manager
            # manager.remove_web_socket(self)
            pass

        def on_message(self, message):
            self.logger(message)
            try:
                message = json.loads(message)
                result = self.application.phaseportrait.manager.handle_json(message)
                if result == 1:
                    self.application.start_phaseportrait(message=message)
                self.write_message(str(result))
            except Exception as e:
                self.logger(e)
                self.write_error(e)
            

    def start_phaseportrait(self, *, message=None):
        self.phaseportrait = PhasePortrait2D(lambda x,y: (y,-x), [[0,1], [0,1]])
        self.phaseportrait.plot()
        
        self.figure = self.phaseportrait.fig
        self.manager = new_figure_manager_given_figure(id(self.figure), self.figure)
        if message is not None:
            result = self.application.phaseportrait.manager.handle_json(message)

    def __init__(self):
        self.start_phaseportrait()

        super().__init__([
            # Static files for the CSS and JS
            (r'/_static/(.*)',
             tornado.web.StaticFileHandler,
            #  {'path': FigureManagerWebAgg.get_static_file_path()}),
            {'path': os.path.join(os.path.dirname(__file__), 'web_backend')}),

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
            ('/pp', self.PPSocket)
        ])

if __name__ == '__main__':

    # modes = {
    #     '--code' : PhasePortrait2DManager.json_to_python_code,
    #     '--plot' : PhasePortrait2DManager.plot_from_json
    # }
    # result = modes[argv[1]](argv[2])
    
    application = PhasePortraitServer()
    http_server = tornado.httpserver.HTTPServer(application)
    http_server.listen(8080)
    print("localhost:8080", flush=True, end='')
    tornado.ioloop.IOLoop.current().start()