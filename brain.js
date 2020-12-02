var request = require('request-promise')

var values = ""

document.getElementById('send').addEventListener('click', () => {
    
    values = document.getElementById('value').value 
    var options = {
        method: 'POST',
        uri: 'http://127.0.0.1:5000/',
        form: {value: values}
    }

    request(options).then(function (innerHTML) {
        document.getElementById('res').innerHTML = innerHTML
    })
})