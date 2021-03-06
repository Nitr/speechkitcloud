(function(webspeechkit){
    webspeechkit.Dictation = function (asr_url, uuid, apikey) {
        this.send = 0;
        this.send_bytes = 0;
        this.proc = 0;
        this.recorder = null;        
        this.recognizer = null;
        this.vad = null;
        this.asr_url = asr_url;
        this.uuid = uuid;
        this.apikey = apikey;
    }

    webspeechkit.Dictation.prototype = {
        webSocketPath: function() {
            if ((this.asr_url.indexOf("wss://")==0) || (this.asr_url.indexOf("ws://")==0))
                return this.asr_url;
            var loc = window.location, new_uri;
            if (loc.protocol === "https:") {
                new_uri = "wss:";
            } else {
                new_uri = "ws:";
            }
            new_uri += "//" + this.asr_url;
            return new_uri;
        }
        ,
        start: function(options) {
            var donothing = function(){};
            this.options = {
                initCallback: donothing,
                errorCallback: donothing,
                dataCallback: donothing,
                infoCallback: donothing,
                stopCallback: donothing,
                punctuation: false,
                model: "freeform",
                lang: "ru-RU",
                format: webspeechkit.FORMAT.PCM16,
                vad: false,
                speechStart: donothing,
                speechEnd: donothing,
                bufferSize: 1024
            };
            
            for(var option in options) {
                if(this.options.hasOwnProperty(option)) {
                    this.options[option] = options[option];
                }
            }

            if (webspeechkit.recorderInited) {
                this.onstart();
            }
            else {
                webspeechkit.initRecorder(
                    this.onstart.bind(this),
                    this.options.errorCallback 
                )               
            }
        }
        ,
        onstart: function() {
            if (this.recorder && this.recorder.isPaused())
                this.recorder.start();

            if (this.recognizer)
                return;
            
            this.send = 0;
            this.send_bytes = 0;
            this.proc = 0;

            if (!this.recorder) {
                this.recorder = new webspeechkit.Recorder(this.options.bufferSize, 1, function(){
                    this.options.errorCallback("Failed to create Recorder");
                }.bind(this), null, this.options.format.samplerate);
                if (this.options.vad)
                    this.vad = new webspeechkit.Vad({recorder: this.recorder,
                                                     speechStart: this.options.speechStart,
                                                     speechEnd: this.options.speechEnd});
            }
            
            this.recognizer = new webspeechkit.Recognizer(
                this.webSocketPath(),
		        {
		            onInit: function(sessionId, code) {
			            this.recorder.start(function(data) {
			                if (this.options.vad && this.vad) {
				                this.vad.update();
			                }
			                this.send++;
			                this.send_bytes += data.byteLength;
			                this.options.infoCallback({
					            send_bytes: this.send_bytes,
					            format: this.options.format,
					            send_packages: this.send,
					            processed: this.proc
					        });
			                this.recognizer.addData(data);
			            }.bind(this), this.options.format)
			            this.options.initCallback(sessionId, code);
		            }.bind(this),
		            onResult: function(text, uttr, merge) {
			            this.proc += merge;
			            this.options.dataCallback(text, uttr, merge); 
		            }.bind(this),
		            onError: function(msg) {
			            this.recorder.stop(function(){});
			            this.recognizer.close()
			            this.recognizer = null;
			            this.options.errorCallback(msg);
		            }.bind(this)
		        },
		        {
		            uuid : this.uuid, 
		            key: this.apikey,
                    model: this.options.model,
                    lang: this.options.lang,
		            format: this.options.format.mime,
		            punctuation : this.options.punctuation,
		        });
            
            this.recognizer.start();
        }
        ,
        stop: function() {
            if (this.recognizer)
                this.recognizer.close();
            
            this.recorder.stop(
                function () {
                    this.recognizer = null;
                    this.options.stopCallback();
                }.bind(this)
            );
        }
        ,
        pause: function() {
            this.recorder.pause();
        }
        ,
        isPaused: function() {
            return (!this.recorder || this.recorder.isPaused());                    
        }
    };
}(window.webspeechkit));
