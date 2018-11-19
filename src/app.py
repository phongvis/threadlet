from flask import Flask, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/")
def index():
    p = request.args.get('params', '')
    return 'Response from server: ' + p

if __name__ == '__main__':
    app.run(debug=True)