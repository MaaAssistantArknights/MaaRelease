from flask import Flask, redirect, url_for, send_from_directory, send_file
import os

app = Flask(__name__)

# get the path of the current file
current_file_path = os.path.abspath(__file__)

# get the directory containing the current file
current_dir_path = os.path.dirname(current_file_path)

dir_path = os.path.join(current_dir_path, "../MaaAssistantArknights/api/")
dir_path = os.path.abspath(dir_path)

@app.route('/MaaAssistantArknights/api/<path:subpath>')
def redirect_to_local_file(subpath):

    # construct local file path by appending subpath to ./tmp/
    local_file_path = os.path.join(dir_path, subpath)
    local_file_path = os.path.abspath(local_file_path)

    print(current_file_path, current_dir_path, dir_path, local_file_path)

    # check if local file exists
    if os.path.exists(local_file_path):
        print("here")
        # redirect to local file using 'file://' scheme
        # return redirect(f'file://{os.path.abspath(local_file_path)}')
        return send_file(local_file_path, as_attachment=False)
    else:
        print("404 Error!!!!!!!!!!!!!!!!!!!!")
        # if local file does not exist, return 404 Not Found error
        return f'Local file {local_file_path} not found', 404

if __name__ == '__main__':
    # run the Flask app with HTTPS
    app.run(host='localhost', port=443, ssl_context=(os.path.join(current_dir_path, "ota.maa.plus.crt"), os.path.join(current_dir_path, "ota.maa.plus.key")), debug=True)

    # app.run(port=7000, debug=True)