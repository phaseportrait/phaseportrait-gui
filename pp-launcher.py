from phaseportrait.phaseportrait import PhasePortrait2DManager
import sys

if __name__ == '__main__':
    modes = {
        '--code' : PhasePortrait2DManager.json_to_python_code,
        '--plot' : PhasePortrait2DManager.plot_from_json
    }
    modes[sys.argv[1]](sys.argv[2])