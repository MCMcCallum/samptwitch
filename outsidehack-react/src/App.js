import React, { Component } from 'react';
import './App.css';
import SearchInput, {createFilter} from 'react-search-input';
import Tuna from 'tunajs';
import 'bootstrap/dist/css/bootstrap.min.css';

// CHANGE IF YOU DO NOT WANT TO USE TWITCH
var twitchOn = true;

//twitch related stuff
var token = "";
var tuid = "";
var ebs = "";
var twitch = undefined;
if (twitchOn) {
    twitch = window.Twitch.ext;

    twitch.onAuthorized(function(auth) {
        // save our credentials
        token = auth.token;
        tuid = auth.userId;
    });
}

//sleep helper function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}



const KEYS_TO_FILTERS = ['artist', 'title']

const context = new AudioContext();
var tuna = new Tuna(context);

const localServer = "https://127.0.0.1:5000";
const remoteServer = "https://35.166.222.57:5000";
//const backendServer = "https://localhost:8081";
const backendServer = "https://ec2-34-227-194-251.compute-1.amazonaws.com:8081"

var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var audio_samples = [];
var audio_data_left;
var audio_data_right;
var sample_info_endpoint = remoteServer + '/trackinfo/';
//var samp_rate = 44100;
var samp_rate = context.sampleRate;
function snippet(start, stop, source) {
  var samp_start = Math.floor(samp_rate*start);
  var samp_stop = Math.floor(samp_rate*stop);
  //console.log(samp_start);
  //console.log(samp_stop);
  var buff_len = samp_stop - samp_start;
  var thisbuffer = audioCtx.createBuffer(2, buff_len, audioCtx.sampleRate);
  thisbuffer.copyToChannel(audio_data_left.slice(samp_start,samp_stop), 0);
  thisbuffer.copyToChannel(audio_data_right.slice(samp_start,samp_stop), 1);
  return thisbuffer;
}

function getData(url, trackbpm, cb) {
  var request = new XMLHttpRequest();
  request.open('GET', url, true);
  request.responseType = 'arraybuffer';
  request.onload = function() {
    var audioData = request.response;
    audioCtx.decodeAudioData(audioData, function(buffer) {
        var myBuffer = buffer;
        audio_data_left = myBuffer.getChannelData(0);
        audio_data_right = myBuffer.getChannelData(1);
        var samples = [];
        var playspeeds = [];
        for(var i=0;i<30;i++)
        {
          var samp = audio_samples[i];
          samples.push(snippet(samp.sampstart, samp.sampend));
          var expected_beatlength = (60.0/trackbpm);
          var actual_length = (samples[samples.length-1].length)/samp_rate;
          var num_beats = Math.round(actual_length/expected_beatlength);
          var expected_samplelength = num_beats*expected_beatlength;
          playspeeds.push(actual_length/expected_samplelength);
        }
        var sampdata = {};
        sampdata.bpm = trackbpm;
        sampdata.samples = samples;
        sampdata.playspeeds = playspeeds;
        //console.log(sampdata.samples[0]);
        cb(sampdata);
      });
  }
  request.send();
}

function getTrackData(trackid, cb) {
    var url = sample_info_endpoint + trackid;
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.onload = function() {
        var trackdata = JSON.parse(request.response);
        //console.log(trackdata);
        audio_samples = [];
        for(var i=0; i<30; i++) {
          var beat_number = trackdata.beat_selections[i];
          // HACK: to handle beat numbers extending beyond end of track:
          if(beat_number >= (trackdata.beat_times.length-4)) {
            beat_number = trackdata.beat_times.length-5;
          }
          var x = {};
          x.sampstart = trackdata.beat_times[beat_number];
          x.sampend = trackdata.beat_times[beat_number+4];
          audio_samples.push(x);
        }

        getData(trackdata.url, trackdata.bpm, cb);
    }
    request.send();
}



function onMIDISuccess(midiAccess) {
  console.log("Accessed MIDI devices.")
  for (var input of midiAccess.inputs.values()) {
    console.log("Found MIDI input.");
    input.onmidimessage = getMIDIMessage;
  }
}

function getMIDIMessage(message) {
  console.log(message);
  var command = message.data[0];
  var note = message.data[1];
  var velocity = (message.data.length > 2) ? message.data[2] : 0;
  switch (command) {
    case 144: // noteOn
      if (velocity > 0) {
        console.log("Note on")
        console.log(note)
        // MAP TO GRID HERE
      } else {
        console.log("Note off")
        console.log(note)
        // noteOff(note);
      }
      break;
    case 128: // noteOff
      console.log("Note off")
      console.log(note)
      // noteOff(note);
      break;

  }
  // Update the grid.
  // this.handleNoteClick(notevalue, beatvalue);
}

function onMIDIFailure() {
  console.log('Could not access your MIDI devices.');
}





class App extends Component {
  constructor(props) {
    super(props);
    this.handleNoteClick = this.handleNoteClick.bind(this);
    this.handleSampleClick = this.handleSampleClick.bind(this);
    this.handleStopClick = this.handleStopClick.bind(this);
    this.handlePlayClick = this.handlePlayClick.bind(this);
    this.handleBPMChange = this.handleBPMChange.bind(this);
    this.handleClearClick = this.handleClearClick.bind(this);
    this.searchUpdated = this.searchUpdated.bind(this)
    this.handleSearchResultClick = this.handleSearchResultClick.bind(this);
    this.handleLoClick = this.handleLoClick.bind(this);
    this.handleHiClick = this.handleHiClick.bind(this);
    this.handleReverbClick = this.handleReverbClick.bind(this);
    this.handleDoubleTimeClick = this.handleDoubleTimeClick.bind(this);
    this.handleHalfTimeClick = this.handleHalfTimeClick.bind(this);
    this.getMIDIMessage = this.getMIDIMessage.bind(this);
    this.onMIDISuccess = this.onMIDISuccess.bind(this);

    this.state = {
      currentBeat: -1,
      noteGrid: [
        [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]
      ],
      bpm: 120,
      lastNote: 0,
      isPlaying: false,
      searchTerm: '',
      library: [],
      loPass: false,
      hiPass: false,
      reverb: false,
      songName: "Search for a song",
      trackid: ''
    };

    this.quadrant = 0;
    this.midiout = {};

    this.effectChains = [];
    for (var i = 0; i < this.state.noteGrid.length; ++i) {
        var loPassFilter = new tuna.Filter({
            frequency: 900, //20 to 22050
            Q: 1, //0.001 to 100
            gain: 0, //-40 to 40 (in decibels)
            filterType: "lowpass", //lowpass, highpass, bandpass, lowshelf, highshelf, peaking, notch, allpass
            bypass: 0
        });
        var hiPassFilter = new tuna.Filter({
            frequency: 2000, //20 to 22050
            Q: 1, //0.001 to 100
            gain: 0, //-40 to 40 (in decibels)
            filterType: "highpass", //lowpass, highpass, bandpass, lowshelf, highshelf, peaking, notch, allpass
            bypass: 0
        });
        var reverbFilter = (function() {
            var convolver = context.createConvolver(),
                noiseBuffer = context.createBuffer(2, 0.15 * context.sampleRate, context.sampleRate),
                left = noiseBuffer.getChannelData(0),
                right = noiseBuffer.getChannelData(1),
                decay = 2;
            for (var i = 0; i < noiseBuffer.length; i++) {
              //  original convolver
              //  left[i] = Math.random() * 2 - 1;
              //  right[i] = Math.random() * 2 - 1;
              left[i] = (Math.random() * 2 - 1) * Math.pow(1 - 1 / noiseBuffer.length, decay);
              right[i] = (Math.random() * 2 - 1) * Math.pow(1 - 1 / noiseBuffer.length, decay);
            }
            convolver.buffer = noiseBuffer;
            return convolver;
        })();
        this.effectChains.push([loPassFilter, hiPassFilter, reverbFilter]);
    }

    this.sampleURLs = [
      "samples/ashanti_ 3613939.wav",
      "samples/hello_245329.wav",
      "samples/bongo_75672061.wav",
      "samples/marley_chord_2.wav",
      "samples/crash_6077722.wav",
      "samples/hat_2264.wav",
      "samples/snare_6077722.wav",
      "samples/kick_4522641.wav"
    ];
    this.sampleBuffers = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];
    this.playSpeeds = [1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0];

    for (var sampleIndex = 0; sampleIndex < this.sampleURLs.length; sampleIndex++) {
      this.loadSample(sampleIndex);
    }

    navigator.requestMIDIAccess()
    .then(this.onMIDISuccess, this.onMIDIFailure);
  }

  // MIDI functions:
  // Midi access

  // function onMIDISuccess(midiAccess) {
  //     console.log(midiAccess);

  //     var inputs = midiAccess.inputs;
  //     var outputs = midiAccess.outputs;
  // }

  onMIDISuccess(midiAccess) {
    console.log("Accessed MIDI devices.")
    for (var input of midiAccess.inputs.values()) {
      console.log("Found MIDI input.");
      input.onmidimessage = this.getMIDIMessage;
    }
    console.log(midiAccess.outputs.values);
    // this.midiout = midiAccess.outputs.values()[0]
    for (var output of midiAccess.outputs.values()) {
      this.midiout = output;
    }
    this.refreshLightState();
    this.midiout.send([144,104,9]);
  }

  padlight(notevalue, beatvalue, turnon, newcolor) {
    if(this.quadrant == 2 || this.quadrant == 3) {
      if(notevalue < 8) {
        return;
      }
      notevalue -= 8;
    } else {
      if(notevalue >= 8) {
        return;
      }
    }
    if(this.quadrant == 1 || this.quadrant == 3) {
      if(beatvalue < 8) {
        return;
      }
      beatvalue -= 8;
    } else {
      if(beatvalue >= 8) {
        return;
      }
    }
    var noteid = ((8-notevalue)*10+1) + beatvalue;
    console.log(noteid)
    if(turnon) {
      var color = newcolor;
    } else {
      var color = 0x00;
    }
    this.midiout.send([144, noteid, color])
  }
  
  clearlights() {
    for(var noteidx = 0; noteidx<8; noteidx++) {
      for(var beatidx = 0; beatidx<8; beatidx++) {
        var noteid = ((8-noteidx)*10+1) + beatidx;
        this.midiout.send([144, noteid, 0x00]);
      }
    }
  }

  turnOnLightColumnFromGrid(beatidx) {
    this.turnOffLightColumn(beatidx)
    for(var noteidx = 0; noteidx<16; noteidx++) {
      if(this.state.noteGrid[noteidx][beatidx]) {
        this.padlight(noteidx, beatidx, true, 0x31);
      }
    }
  }
  
  turnOnLightColumn(beatidx) {
    for(var noteidx = 0; noteidx<16; noteidx++) {
      this.padlight(noteidx, beatidx, true, 0x05);
    }
  }

  turnOffLightColumn(beatidx) {
    for(var noteidx = 0; noteidx<16; noteidx++) {
      this.padlight(noteidx, beatidx, false, 0x05);
    }
  }

  refreshLightState() {
    for(var beatidx = 0; beatidx<16; beatidx++) {
      this.turnOnLightColumnFromGrid(beatidx);
    }
  }

  getMIDIMessage(message) {
    // console.log(message);
    var command = message.data[0];
    var note = message.data[1];
    var velocity = (message.data.length > 2) ? message.data[2] : 0;
    switch (command) {
      case 144: // noteOn
        if (velocity > 0) {
          // console.log("Note on")
          // console.log(note)
          var notevalue = Math.floor(note/10.0);
          if(notevalue>8) {
            return;
          }
          var beatvalue = note - 10*notevalue - 1;
          if(beatvalue>8) {
            return;
          }
          notevalue = 8 - notevalue;
          if(this.quadrant == 2 || this.quadrant == 3) {
            notevalue += 8;
          }
          if(this.quadrant == 1 || this.quadrant == 3) {
            beatvalue += 8;
          }
          // Update the grid.
          this.handleNoteClick(notevalue, beatvalue);
          // MAP TO GRID HERE
        }// else {
          // console.log("Note off")
          // console.log(note)
          // noteOff(note);
        // }
        break;
      case 128: // noteOff
        // console.log("Note off")
        // console.log(note)
        // noteOff(note);
        break;
      case 176:
        if(note < 104 || note > 106){
          return;
        }
        if(note == 104) {
          // upper left
          this.quadrant = 0;
          this.midiout.send([144,104,9]);
          this.midiout.send([144,105,0]);
          this.midiout.send([144,106,0]);
          this.midiout.send([144,107,0]);
        }
        else if(note == 105) {
          // upper right
          this.quadrant = 1;
          this.midiout.send([144,104,0]);
          this.midiout.send([144,105,9]);
          this.midiout.send([144,106,0]);
          this.midiout.send([144,107,0]);
        }
        else if(note == 106) {
          // lower left
          this.quadrant = 2;
          this.midiout.send([144,104,0]);
          this.midiout.send([144,105,0]);
          this.midiout.send([144,106,9]);
          this.midiout.send([144,107,0]);
        }
        else if(note == 107) {
          this.quadrant = 3;
          this.midiout.send([144,104,0]);
          this.midiout.send([144,105,0]);
          this.midiout.send([144,106,0]);
          this.midiout.send([144,107,9]);
        }
        this.refreshLightState();
        break;
    }
  }

  onMIDIFailure() {
    console.log('Could not access your MIDI devices.');
  }

  loadSample(sampleIndex){
    fetch(this.sampleURLs[sampleIndex])
    .then(response => response.arrayBuffer())
    .then(buffer => {
      context.decodeAudioData(buffer, decoded => {
        this.sampleBuffers[sampleIndex] = decoded ;
      }).catch(e => {
        console.log("error: ", e);
      });
    })
    .catch(e => {
      console.log("error: ", e);
    });
  }

  tick() {
    if (!this.state.isPlaying)  {
      return;
    }
    var d = new Date();
    var currTime = d.getTime();
    if ((currTime - this.state.lastNote) > (60 *1000/ this.state.bpm)){
      this.turnOnLightColumnFromGrid((this.state.currentBeat) % 16);
      this.setState({
        currentBeat: (this.state.currentBeat + 1) % 16,
        lastNote: currTime
      });
      this.turnOnLightColumn((this.state.currentBeat) % 16);
      for (var sampleIndex = 0; sampleIndex < this.state.noteGrid.length; sampleIndex++) {
        if (this.state.noteGrid[sampleIndex][this.state.currentBeat] && this.sampleBuffers[sampleIndex]) {
          this.playNote(sampleIndex);
        }
      }
      // Update midi out:
      
    }

    setTimeout(
      () => this.tick(), 0);
  }

  playNote(sampleIndex) {

    var source = context.createBufferSource();
    source.buffer = this.sampleBuffers[sampleIndex];
    // source.playbackRate.value = this.playSpeeds[sampleIndex];
    var currentLastNode = context.destination;

    if (this.state.loPass) {
      this.effectChains[sampleIndex][0].connect(currentLastNode);
      currentLastNode = this.effectChains[sampleIndex][0];
    }
    if (this.state.hiPass) {
        this.effectChains[sampleIndex][1].connect(currentLastNode);
        currentLastNode = this.effectChains[sampleIndex][1];
    }
    if (this.state.reverb) {
        this.effectChains[sampleIndex][2].connect(currentLastNode);
        currentLastNode = this.effectChains[sampleIndex][2];
    }
    source.connect(currentLastNode);
    source.start();
  }

  componentDidMount() {
    //ugggh hacky js
    var that = this;
    fetch(remoteServer + "/getlibrary")
    .then((response) => {
      return response.json();
    })
    .then((json) => {
      this.setState({
        library:json
      })
    })
    .then(() => {
        // wait for twitch authentication
        if (!twitchOn)
            return;

        this.waitForToken();
        if (!token)
            console.log("Failed getting token...backend won't work!");
    })
    .then(() => {
        if (!twitchOn)
            return;
        // get initial state from backend
        return fetch(backendServer + '/samptwitch/query', {
            headers: {'Authorization': 'Bearer ' + token}
        })
    })
    .then(function(response) {
        if (!twitchOn)
            return;
        return response.json();
    })
    .then(function(data) {
        if (!twitchOn)
            return;
        // console.log(data);
        that.setState({
            noteGrid: data.grid
        });

        that.handleNewTrackIdFromBackend(data.trackid, data.songname);
    })
    .then(() => {
        if (!twitchOn)
            return;
        // listen for incoming broadcast message from our EBS
        twitch.listen('broadcast', function (target, contentType, state) {
            twitch.rig.log('Received broadcast message!!');
            var stateObj = JSON.parse(state);
            that.updateStateFromBackend(stateObj);
        });
    });
  }

  async waitForToken() {
      var count = 0;
      while (true){
          count += 1;
          if (!token) {
              console.log("Waiting for token...");
              await sleep(1000);
          }
          else {
              console.log("Have token!");
              break;
          }

          if (count == 100)
            break;
      }
  }

  updateStateFromBackend(state) {
      if (!twitchOn)
        return;

      this.setState({
          noteGrid: state.grid
      });

      if (this.state.trackid != state.trackid) {
          this.handleNewTrackIdFromBackend(state.trackid, state.songname);
      }
  }

  sendStateToBackend() {
      if (!twitchOn)
        return;

      var currentState = {
          bpm: this.state.bpm,
          trackid: this.state.trackid,
          effects: [this.state.loPass, this.state.hiPass],
          grid: this.state.noteGrid,
          songname: this.state.songName
      }

      fetch(backendServer + '/samptwitch/change', {
          headers: {'Authorization': 'Bearer ' + token},
          method: 'POST',
          body: JSON.stringify(currentState)
      })
  }

  handleNoteClick(sampleIndex, currentBeat){

    var newNoteGrid = this.state.noteGrid;
    newNoteGrid[sampleIndex][currentBeat] = !newNoteGrid[sampleIndex][currentBeat];
    this.setState({
      noteGrid: newNoteGrid
    }, this.sendStateToBackend);
    this.padlight(sampleIndex, currentBeat, newNoteGrid[sampleIndex][currentBeat], 0x31);
  }

  handleSampleClick(sampleIndex){
    if (this.sampleBuffers[sampleIndex]){
      var source = context.createBufferSource();
      source.buffer = this.sampleBuffers[sampleIndex];
      // source.playbackRate.value = this.playSpeeds[sampleIndex];
      source.connect(context.destination);
      source.start();
    }
  }
  handleStopClick() {
    this.setState({
      currentBeat: -1,
      isPlaying: false
    });
    this.refreshLightState();
  }
  handlePlayClick(){

    if (this.state.isPlaying) { return; }

    this.setState({
      isPlaying:true
    });
    setTimeout(
      () => this.tick(),
      (60 *1000/ this.state.bpm)
    );
  }

  handleBPMChange(e){
    this.setState({
      bpm:parseInt(e.target.value, 10)
    });
  }

  handleClearClick() {
    var newNoteGrid = [];
    for (var i = 0; i < 16; i++){
      var row = [];
      for (var j = 0; j < 16; j++) {
        row.push(false);
      }
      newNoteGrid.push(row);
    }
    this.setState({
      noteGrid: newNoteGrid
    }, this.sendStateToBackend);
  }

  searchUpdated (term) {
    this.setState({
      searchTerm: term,
      isPlaying: false,
      currentBeat: -1
    })
  }

  handleNewTrackIdFromBackend(trackid, songname){
    let self = this;
    getTrackData(trackid, function(return_data){
      for (var i = 8; i < 16; i++){
          self.sampleBuffers[i] = return_data.samples[i];
          self.playSpeeds[i] = return_data.playspeeds[i];
      }
      self.setState({
        bpm: (return_data.bpm * 1.01), // HACK: Just to make sure the samples bleed into each other a little.
        trackid: trackid,
        songName: songname
      })
    })
  }

  handleSearchResultClick(searchResult){
    var trackid = searchResult["trackid"];
    var songName = searchResult["artist"] + " - " + searchResult["title"];
    let self = this;
    getTrackData(trackid, function(return_data){
      for (var i = 8; i < 16; i++){
        self.sampleBuffers[i] = return_data.samples[i];
        self.playSpeeds[i] = return_data.playspeeds[i];
      }
      self.setState({
        bpm: (return_data.bpm * 1.01), // HACK: Just to make sure the samples bleed into each other a little.
        songName: songName,
        trackid: trackid
        }, self.sendStateToBackend);
    })
  }
  handleLoClick() {
    this.setState({
      loPass: !this.state.loPass
    });
  }
  handleHiClick() {
    this.setState({
      hiPass: !this.state.hiPass
    });
  }
  handleReverbClick() {
    this.setState({
      reverb: !this.state.reverb
    });
  }
  handleHalfTimeClick() {
    this.setState({
      bpm: this.state.bpm / 2
    });
  }
  handleDoubleTimeClick() {
    this.setState({
      bpm: this.state.bpm * 2
    });
  }
  render() {
    var filteredSearchResults = this.state.library.filter(createFilter(this.state.searchTerm, KEYS_TO_FILTERS))
    if (filteredSearchResults.length === this.state.library.length){
      filteredSearchResults = [];
    }
    filteredSearchResults = filteredSearchResults.slice(0, 7);

    var hiPassButtonStyle = {};
    if (this.state.hiPass){
      hiPassButtonStyle["backgroundColor"] = "#c5bade"
    } else {
      hiPassButtonStyle["backgroundColor"] = "white"
    }

    var loPassButtonStyle = {};
    if (this.state.loPass){
      loPassButtonStyle["backgroundColor"] = "#c5bade"

    } else {
      loPassButtonStyle["backgroundColor"] = "white"
    }

    var reverbButtonStyle = {};
    // reverbButtonStyle["width"] = 40
    if (this.state.reverb){
      reverbButtonStyle["backgroundColor"] = "#c5bade"
    } else {
      reverbButtonStyle["backgroundColor"] = "white"
    }

    var headerStyle = {};
    headerStyle["marginLeft"] = "30px";


    return (
      <div className="container">
        <div className="row top-row">
          <input type="number" className="tempo" onChange={this.handleBPMChange} value={this.state.bpm} min="60" max="1000"></input>
          <button className="tempo" onClick={this.handleHalfTimeClick} data-toggle="button"><b>.5X</b></button>
          <button className="tempo" onClick={this.handleDoubleTimeClick} data-toggle="button"><b>2X</b></button>
          <Player onStopClick={this.handleStopClick} onPlayClick={this.handlePlayClick}/>
          <div className="effects">
            <button onClick={this.handleLoClick} style={loPassButtonStyle} data-toggle="button"><b>LO</b></button>
            <button onClick={this.handleHiClick} style={hiPassButtonStyle} data-toggle="button"><b>HI</b></button>
            <button onClick={this.handleReverbClick} style={reverbButtonStyle} data-toggle="button"><b>RE</b></button>
          </div>
          <button className="top-right" onClick={this.handleClearClick}><b>X</b></button>
        </div>
        <SampleSequence name="A" sequence={this.state.noteGrid[0]} sampleIndex={0} currentBeat={this.state.currentBeat} onSampleClick={this.handleSampleClick} onNoteClick={this.handleNoteClick} />
        <SampleSequence name="B" sequence={this.state.noteGrid[1]} sampleIndex={1} currentBeat={this.state.currentBeat} onSampleClick={this.handleSampleClick} onNoteClick={this.handleNoteClick}/>
        <SampleSequence name="C" sequence={this.state.noteGrid[2]} sampleIndex={2} currentBeat={this.state.currentBeat} onSampleClick={this.handleSampleClick} onNoteClick={this.handleNoteClick}/>
        <SampleSequence name="D" sequence={this.state.noteGrid[3]} sampleIndex={3} currentBeat={this.state.currentBeat} onSampleClick={this.handleSampleClick} onNoteClick={this.handleNoteClick}/>
        <SampleSequence name="E" sequence={this.state.noteGrid[4]} sampleIndex={4} currentBeat={this.state.currentBeat} onSampleClick={this.handleSampleClick} onNoteClick={this.handleNoteClick} />
        <SampleSequence name="F" sequence={this.state.noteGrid[5]} sampleIndex={5} currentBeat={this.state.currentBeat} onSampleClick={this.handleSampleClick} onNoteClick={this.handleNoteClick}/>
        <SampleSequence name="G" sequence={this.state.noteGrid[6]} sampleIndex={6} currentBeat={this.state.currentBeat} onSampleClick={this.handleSampleClick} onNoteClick={this.handleNoteClick}/>
        <SampleSequence name="H" sequence={this.state.noteGrid[7]} sampleIndex={7} currentBeat={this.state.currentBeat} onSampleClick={this.handleSampleClick} onNoteClick={this.handleNoteClick}/>
        <SampleSequence name="I" sequence={this.state.noteGrid[8]} sampleIndex={8} currentBeat={this.state.currentBeat} onSampleClick={this.handleSampleClick} onNoteClick={this.handleNoteClick} />
        <SampleSequence name="J" sequence={this.state.noteGrid[9]} sampleIndex={9} currentBeat={this.state.currentBeat} onSampleClick={this.handleSampleClick} onNoteClick={this.handleNoteClick}/>
        <SampleSequence name="K" sequence={this.state.noteGrid[10]} sampleIndex={10} currentBeat={this.state.currentBeat} onSampleClick={this.handleSampleClick} onNoteClick={this.handleNoteClick}/>
        <SampleSequence name="L" sequence={this.state.noteGrid[11]} sampleIndex={11} currentBeat={this.state.currentBeat} onSampleClick={this.handleSampleClick} onNoteClick={this.handleNoteClick}/>
        <SampleSequence name="M" sequence={this.state.noteGrid[12]} sampleIndex={12} currentBeat={this.state.currentBeat} onSampleClick={this.handleSampleClick} onNoteClick={this.handleNoteClick} />
        <SampleSequence name="N" sequence={this.state.noteGrid[13]} sampleIndex={13} currentBeat={this.state.currentBeat} onSampleClick={this.handleSampleClick} onNoteClick={this.handleNoteClick}/>
        <SampleSequence name="O" sequence={this.state.noteGrid[14]} sampleIndex={14} currentBeat={this.state.currentBeat} onSampleClick={this.handleSampleClick} onNoteClick={this.handleNoteClick}/>
        <SampleSequence name="P" sequence={this.state.noteGrid[15]} sampleIndex={15} currentBeat={this.state.currentBeat} onSampleClick={this.handleSampleClick} onNoteClick={this.handleNoteClick}/>
        <div className="row songName">
          {this.state.songName}
        </div>
        <SearchInput className="search-input row" onChange={this.searchUpdated} />
        {filteredSearchResults.map(searchResult => {
          return (
            <div className="row search-row" key={searchResult.trackid} onClick={()=>{this.handleSearchResultClick(searchResult)}}>{searchResult.artist} - {searchResult.title}</div>
          )
        })}
      </div>
    );
  }
}

class Player extends React.Component {
  constructor(props){
    super(props);
    this.handleStopClick = this.handleStopClick.bind(this);
    this.handlePlayClick = this.handlePlayClick.bind(this);

  }
  handleStopClick(e){
    this.props.onStopClick();
  }
  handlePlayClick(e){
    this.props.onPlayClick();
  }
  render() {
    return(
      <div className="player" >
        <button title="Play" onClick={this.handlePlayClick}> &#9658; </button>
        <button title="Stop" onClick={this.handleStopClick}> &#9632; </button>
      </div>
    );
  }
}

class SampleSequence extends React.Component {
  constructor() {
    super();
    this.handleNoteClick = this.handleNoteClick.bind(this);
    this.handleSampleClick = this.handleSampleClick.bind(this);

    this.buffer = null;
  }

  handleNoteClick(currentBeat){
    this.props.onNoteClick(this.props.sampleIndex, currentBeat);
  }
  handleSampleClick(e) {
    this.props.onSampleClick(this.props.sampleIndex);
  }
  render() {
    var buttonStyle = {}
    if (this.props.name < "I") {
      buttonStyle["backgroundColor"] = "#ff9933";
      buttonStyle["borderColor"] = "#604896";

    } else {
      buttonStyle["backgroundColor"] = "#8cc5cc";
      buttonStyle["borderColor"] = "#604896";
    }
    var noteButtonStyle = {}
    if (this.props.name < "I") {
      noteButtonStyle["backgroundColor"] = "#fce5cf";
      noteButtonStyle["borderColor"] = "#604896";

    } else {
      noteButtonStyle["backgroundColor"] = "#cce2e5";
      noteButtonStyle["borderColor"] = "#604896";
    }

    const counts = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    var sampleSequenceJSX = [];
    for(var i = 0; i < this.props.sequence.length; i++) {
        var row = [];
        var count = counts[i];
        var isPlaying = false;
        if (this.props.currentBeat === count){
          isPlaying = true;
        }
        row.push(<Note style={noteButtonStyle} key={count.toString()} sampleIndex={this.props.sampleIndex} isPlaying={isPlaying} isOn={this.props.sequence[i]} onNoteClick={this.handleNoteClick} count={count}>
        </Note>);
        sampleSequenceJSX.push(row);
    }
    return (
      <div className="row">

        <button className="btn-sample" style={buttonStyle} type="button" onClick={() => {this.handleSampleClick(this.props.sampleIndex)}}> {this.props.name} </button>
        {sampleSequenceJSX}
      </div>
    );
  }
}

class Note extends React.Component {

  constructor(props) {
    super(props);
    this.handleNoteClick = this.handleNoteClick.bind(this);
  }
  handleNoteClick(e) {
    this.props.onNoteClick(this.props.count);
  }
  render() {
    var styleButton = JSON.parse(JSON.stringify(this.props.style));
    if (this.props.isPlaying) {
      styleButton["backgroundColor"] = "#ff8080";
      styleButton["color"] = "white";

    }
    if (this.props.isOn) {
      styleButton['backgroundColor'] = "#c5bade"
    }

    var text="";
    if (((this.props.count % 4) + 1) === 1) {
      text="\u2022";
    }

    return (
      <button type="button" onClick={this.handleNoteClick} style={styleButton}>{text}</button>
    );

  }

}

export default App;
