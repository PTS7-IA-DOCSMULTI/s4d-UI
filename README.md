# S4D-UI
S4D-UI is an interface for S4D to allow human supervision of the diarization.

## Install

### Install dependencies for python script
Manually install all dependencies used in supervision.py

### Install dependencies for NodeJS
```
npm install
```

## Usage

### Launch python server
Launch supervision.py
```
python3 supervision.py
```

### Launch app
```
npm start
```

### Open a file

You can open an audio file (wav/mp3) via the menu File -> Open.
Make sure you have the .mdtm .first.mdtm wx.h5 .scores.h5 .ref.mdtm .uem files in the same folder as the audio file otherwise it will not work.

You can test the program with the data sets provided in the [data folder](https://github.com/PTS7-IA-DOCSMULTI/s4d-UI/tree/master/data)

## License
[LGPL3](https://choosealicense.com/licenses/lgpl-3.0/)