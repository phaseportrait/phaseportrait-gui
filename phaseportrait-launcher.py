from phaseportrait_local.phaseportrait import PhasePortrait2DManager
from sys import argv

if __name__ == '__main__':
    modes = {
        '--code' : PhasePortrait2DManager.json_to_python_code,
        '--plot' : PhasePortrait2DManager.plot_from_json
    }
    print(modes[argv[1]](argv[2]))
    
    
# from phaseportrait.phaseportrait import PhasePortrait2DManager
# from sys import argv

# if __name__ == '__main__':
#     with open('duck.txt', 'w') as file:
#         file.write(str(argv))
#         modes = {
#             '--code' : PhasePortrait2DManager.json_to_python_code,
#             '--plot' : PhasePortrait2DManager.plot_from_json
#         }
#         output = modes[argv[1]](argv[2])

#         file.write(str(output))
#         print(str(output))