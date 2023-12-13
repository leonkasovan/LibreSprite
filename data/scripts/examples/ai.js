const defaultSettings = {
    serverType:"easydiffusion",
    easydiffusion: {
        endpoint:'http://localhost:9000'
    },
    model: '',
    prompt: '',
    negativePrompt: '',
    inferenceSteps: 15,
    guidanceScale: 8,
    width: 128,
    height: 128,
    uniqueFilenames: 0
};

function get(url, cb) {
    const key = ai.nextNodeId++ + 'h';
    ai[key + '_fetch'] = function() {
        const status = storage.get(key + '_status');
        const string = storage.get(key);
        delete ai[key + '_fetch'];
        cb({
            string,
            key,
            status
        });
    };
    storage.fetch(url, key);
}

function post(url, body, cb) {
    const key = ai.nextNodeId++ + 'h';
    ai[key + '_fetch'] = function() {
        const status = storage.get(key + '_status');
        const string = storage.get(key);
        delete ai[key + '_fetch'];
        cb({
            string,
            key,
            status
        });
    };
    storage.fetch(url, key, "", "POST", body, "Content-Type", "application/json");
}

const easydiffusion = {
    get:function(path, cb) {
        get(ai.settings.easydiffusion.endpoint + path, function(rsp) {
            var data, error = rsp.status != 200 ? 'status:' + rsp.status : 0;
            try {
                if (!error)
                    data = JSON.parse(rsp.string);
            } catch (ex) {
                error = ex;
            }
            cb(data, error);
        });
    },

    post:function(path, body, cb) {
        post(ai.settings.easydiffusion.endpoint + path, body, function(rsp) {
            var data, error = rsp.status != 200 ? 'status:' + rsp.status : 0;
            try {
                if (!error)
                    data = JSON.parse(rsp.string);
            } catch (ex) {
                error = ex;
            }
            cb(data, error);
        });
    },

    getModels:function(cb) {
        if (ai.settings.easydiffusion["stable-diffusion"] && ai.settings.easydiffusion["stable-diffusion"].length) {
            init();
            cb();
            return;
        }
        this.get('/get/models', function(data, error) {
            if (!error) {
                Object.assign(ai.settings.easydiffusion, data.options);
                ai.saveSettings();
            }
            ai.settings.easydiffusion.session_id = Date.now() + '';
            if (!error)
                init();
            cb(error);
        });

        function init() {
            if (!ai.settings.model &&
                ai.settings.easydiffusion["stable-diffusion"] &&
                ai.settings.easydiffusion["stable-diffusion"].length) {
                ai.settings.model = ai.settings.easydiffusion["stable-diffusion"][0];
            }
        }
    },

    render:function(obj, cb) {
        this.post('/render', JSON.stringify(obj), function(data, error) {
            if (error) {
                cb(null, error);
                return;
            }
            ping(data);
        });

        function ping(ticket) {
            get(ai.settings.easydiffusion.endpoint + ticket.stream, function(rsp) {
                var data, error = rsp.status != 200 ? 'status:' + rsp.status : 0;
                if (error) {
                    cb(null, error);
                    return;
                }

                var done = false;
                var obj;
                try {obj = JSON.parse(rsp.string + '');} catch (ex) {
                    var raw = (rsp.string + '').match(/\{[^}]+\}/g);
                    if (raw) {
                        try {obj = JSON.parse(raw.pop());} catch (ex) {}
                    }
                }

                if (obj) {
                    done = obj.output && obj.output.length;
                    cb(done ? {data:obj.output[0].data} : {percent: obj.step * 100 / obj.total_steps});
                    done = "status" in obj;
                }

                if (!done) {
                    ai.ping = ping.bind(this, ticket);
                    app.yield("ping", 120);
                }
            });
        }
    }
}

const views = {
    main : [
        {
            type:"button",
            text:"Settings...",
            click:function(){
                ai.view("settings");
            }
        },
        {
            if:function(){return ai.settings.serverType == "easydiffusion"},
            then:[
                {type:"break"},
                {
                    type:"button",
                    text:"Text to Image...",
                    click:function(){
                        ai.view("wait", true);
                        easydiffusion.getModels(function(error){
                            if (error) {
                                ai.logError(error);
                                ai.close("wait");
                            } else
                                ai.view("easydiffusion_T2I");
                        });
                    }
                }
            ]
        }
    ],

    wait : [
        {canClose:false},
        {type:"label", text:"Please wait"}
    ],

    settings : [
        {type:"label", text:"EasyDiffusion Endpoint:"},
        {type:"break"},
        {
            type:"entry",
            bind:"settings.easydiffusion.endpoint"
        }
    ],

    choose_model : [
        {type:"label", text:"Choose a Model:"},
        {dynamic:function(){
            const models = ai.settings.easydiffusion["stable-diffusion"];
            const options = [];
            for (var i = 0; i < models.length; ++i) {
                if (i % 3 == 2)
                    options.push({type:"break"});
                options.push({
                    type:"button",
                    text:models[i],
                    click: (function(model){
                        ai.settings.model = model;
                        ai.close("choose_model");
                    }).bind(this, models[i])
                });
            }
            return options;
        }}
    ],

    easydiffusion_T2I : [

        {type:"label", text:"Prompt:"},
        {type:"break"},
        {
            type:"entry",
            maxsize:128,
            bind:"settings.prompt"
        },
        {type:"break"},

        {type:"label", text:"Negative Prompt:"},
        {type:"break"},
        {
            type:"entry",
            maxsize:128,
            value:function(){return ai.settings.negativePrompt;},
            change:function(text){ai.settings.negativePrompt = text;}
        },
        {type:"break"},

        {
            type:"int",
            text:"Steps:",
            min:1,
            max:100,
            value:function(){return ai.settings.inferenceSteps;},
            change:function(value){ai.settings.inferenceSteps = value;}
        },

        {
            type:"int",
            text:"Guidance Scale:",
            min:0,
            max:30,
            value:function(){return ai.settings.guidanceScale;},
            change:function(value){ai.settings.guidanceScale = value;}
        },
        {type:"break"},
        {
            type:"int",
            text:"Width:",
            min:256,
            max:1024,
            value:function(){return ai.settings.width;},
            change:function(value){ai.settings.width = value;}
        },

        {
            type:"int",
            text:"Height:",
            min:256,
            max:1024,
            value:function(){return ai.settings.height;},
            change:function(value){ai.settings.height = value;}
        },
        {type:"break"},

        {type:"button", click:"choose_model", text:function(){return ai.settings.model;}},
        {
            type:"button",
            text:"Redo",
            click:function(){
                ai.generate(ai.settings.seed);
            }
        },
        {
            type:"button",
            text:"Gen",
            click:function(){
                ai.generate();
            }
        }
    ]
};

function AI() {
    this.stack = [];
    this.settings = Object.assign(Object.create(null), defaultSettings);
    this.dlg = null;
    this.nextNodeId = 1;

    if (storage.load("settings")) {
        var str;
        try {
            Object.assign(this.settings, JSON.parse(str = storage.get("settings")));
        } catch (ex) {
            console.log("Could not parse:" + str, ex + '');
        }
    }
}

Object.assign(AI.prototype, {
    init:function() {this.view("main");},

    saveSettings:function() {
        var clone = JSON.parse(JSON.stringify(this.settings));
        storage.set(JSON.stringify(clone), "settings");
        storage.save("settings");
    },

    generate:function(seed) {
        if (!seed)
            seed = Math.random() * 0x7FFFFFFF >>> 0;
        this.settings.seed = seed;
        this.saveSettings();
        this.view("wait", true);
        easydiffusion.render({
            "prompt": this.settings.prompt,
            "seed": seed,
            "used_random_seed": true,
            "negative_prompt": this.settings.negativePrompt,
            "num_outputs": 1,
            "num_inference_steps": this.settings.inferenceSteps,
            "guidance_scale": this.settings.guidanceScale,
            "width": this.settings.width,
            "height": this.settings.height,
            "vram_usage_level": "balanced",
            "sampler_name": "euler_a",
            "use_stable_diffusion_model": this.settings.model,
            "clip_skip": false,
            "use_vae_model": "",
            "stream_progress_updates": true,
            "stream_image_progress": false,
            "show_only_filtered_image": true,
            "block_nsfw": false,
            "output_format": "png",
            "output_quality": 75,
            "output_lossless": false,
            "metadata_output_format": "none",
            "original_prompt": this.settings.prompt,
            "active_tags": [],
            "inactive_tags": [],
            "session_id": this.settings.easydiffusion.session_id
        }, (function(obj, error){
            if (error) {
                ai.logError(error);
                this.close("wait");
                return;
            }
            if (obj.data) {
                this.close("wait");
                var fileName = this.settings.uniqueFilenames ? seed + '' : 'ai';
                storage.set(obj.data.substr(obj.data.indexOf(',') + 1), 'png', fileName);
                storage.decodeBase64('png', fileName);
                var path = storage.save('png', fileName);
                storage.unload('png', fileName);
                if (path)
                    app.open(path);
            } else if (obj.percent) {
                this.dlg.title = (obj.percent|0) + "%";
            }
        }).bind(this));
    },

    close:function(name) {
        if (this.stack.length == 0) {
            console.log("No window to close");
            return;
        }
        if (this.stack[this.stack.length - 1].name != name){
            console.log("Expected to close ", this.stack[this.stack.length - 1].name, "got", name);
            return;
        }
        if (this.dlg) {
            this.dlg.close();
            this.dlg = null;
        }
        this.stack.pop();
        if (this.stack.length == 0)
            return;
        name = this.stack[this.stack.length - 1].name;
        this.stack.pop();
        this.view(name);
    },

    logError:function(error) {
        if (!error)
            return;
        if (error == "status:0") {
            error = "\n"
                + "***************************************\n*\n"
                + "* Could not connect to EasyDiffusion at:\n"
                + "*      " + ai.settings.easydiffusion.endpoint + "\n*\n"
                + "* Make sure it is running or download the installer at:\n"
                + "*      https://easydiffusion.github.io/\n*\n"
                + "***************************************\n\n"
        } else {
            error = "Easy Diffusion error: " + error;
        }
        console.log(error);
    },

    getSetting:function(path, defval) {
        var obj = this;
        var parts = (path + '').split('.');
        while (parts.length) {
            var key = parts.shift();
            if (!obj || !(key in obj))
                return defval;
            obj = obj[key];
        }
        return obj;
    },

    setSetting:function(path, value) {
        var obj = this;
        var parts = (path + '').split('.');
        while (parts.length) {
            var key = parts.shift();
            if (parts.length)
                obj = obj[key];
            else {
                obj[key] = value;
                this.saveSettings();
            }
        }
    },

    view:function(name, isTmp) {
        if (this.dlg) {
            this.dlg.close();
            this.dlg = null;
        }

        if (!views[name]) {
            console.log('No view named "' + name + '"');
            return;
        }

        const dlgId = this.nextNodeId++;
        const dlg = this.dlg = app.createDialog(dlgId + 'D');
        this[dlgId + "D_close"] = this._close.bind(this, dlgId);
        if (this.stack.length && this.stack[this.stack.length - 1].isTmp)
            this.stack.pop();
        this.stack.push({name, dlgId, isTmp});
        dlg.title = 'AI: ' + name
            .replace(/_/g, ' ')
            .replace(/(^| )(.)/g, function(_, e, l){return e + l.toUpperCase();});

        process.call(this, views[name]);

        function process(viewMeta) {
            for (var i = 0; i < viewMeta.length; ++i) {
                var nodeMeta = viewMeta[i];

                if (typeof nodeMeta.bind == "string") {
                    nodeMeta = Object.assign(Object.create(null), nodeMeta);
                    nodeMeta.value = this.getSetting(nodeMeta.bind, nodeMeta.value);
                    nodeMeta.change = this.setSetting.bind(this, nodeMeta.bind);
                }

                switch (get(nodeMeta, 'type', "special").toLowerCase()) {
                case 'label':
                    dlg.addLabel(
                        get(nodeMeta, 'text', get(nodeMeta, 'value', '')),
                        this.nextNodeId++ + 'L');
                    break;

                case 'button':
                    var click = nodeMeta.click;
                    if (typeof click == "string")
                        click = (function(name){this.view(name);}).bind(this, click);
                    this[this.nextNodeId + "B_click"] = click.bind(this);
                    dlg.addButton(
                        get(nodeMeta, 'text', ''),
                        this.nextNodeId++ + 'B');
                    break;

                case 'break':
                    dlg.addBreak();
                    break;

                case 'int':
                    this[this.nextNodeId + "I_change"] = (function(id, cb){
                        cb(storage.get(id + 'I'));
                    }).bind(this, this.nextNodeId, nodeMeta.change);
                    var entry = dlg.addIntEntry(
                        get(nodeMeta, 'text', ''),
                        this.nextNodeId++ + 'I',
                        get(nodeMeta, 'min', 0),
                        get(nodeMeta, 'max', 100)
                    );
                    entry.value = get(nodeMeta, 'value', '');
                    break;

                case 'entry':
                    this[this.nextNodeId + "E_change"] = (function(id, cb){
                        cb(storage.get(id + 'E'));
                    }).bind(this, this.nextNodeId, nodeMeta.change);
                    var entry = dlg.addEntry(
                        get(nodeMeta, 'text', ''),
                        this.nextNodeId++ + 'E'
                    );
                    entry.maxsize = get(nodeMeta, 'maxsize', 40);
                    entry.value = get(nodeMeta, 'value', '');
                    break;

                case 'special':
                    if (typeof nodeMeta['if'] == 'function') {
                        if (nodeMeta['if']())
                            process.call(this, nodeMeta.then);
                    } else if (typeof nodeMeta['dynamic'] == 'function') {
                        process.call(this, nodeMeta['dynamic']());
                    } else {
                        Object.assign(dlg, nodeMeta);
                    }
                    break;

                }
            }
        }

        function get(obj, key, def) {
            if (!(key in obj))
                return def;
            if (typeof obj[key] == 'function')
                return obj[key]();
            return obj[key];
        }
    },

    _close:function(dlgId) {
        if (this.stack.length == 0) {
            console.log("No window to close");
            return;
        }
        if (this.stack[this.stack.length - 1].dlgId != dlgId){
            console.log("Expected to close ", this.stack[this.stack.length - 1].dlgId, "got", dlgId);
            return;
        }
        this.stack.pop();
        if (this.stack.length == 0)
            return;
        const name = this.stack[this.stack.length - 1].name;
        this.stack.pop();
        this.view(name);
    }
});

function onEvent(event) {
    if (typeof ai == "undefined")
        ai = new AI();
    if (typeof ai[event] == "function") {
        ai[event]();
    } else {
        console.log("Unknown event " + event);
    }
}
