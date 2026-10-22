from superset import app
# app.run(debug=True, host='0.0.0.0', port=8888)
app.run(debug=True, host='0.0.0.0', port=8888, threaded=True)
# app.run(debug=True, host='0.0.0.0')

