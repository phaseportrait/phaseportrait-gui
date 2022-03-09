from phaseportrait import PhasePortrait2DManager
from sys import argv

if __name__ == '__main__':
    modes = {
        '--code' : PhasePortrait2DManager.json_to_python_code,
        '--plot' : PhasePortrait2DManager.plot_from_json
    }
    print(modes[argv[1]](argv[2]))