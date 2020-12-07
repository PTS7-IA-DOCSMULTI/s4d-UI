from flask import Flask, request

app = Flask(__name__)

@app.route('/',methods=['POST'])
def handle():
	val = request.form.get('value')
	return str("recu "+val)

if __name__ == "__main__":
	app.run(debug=True,port=5000)