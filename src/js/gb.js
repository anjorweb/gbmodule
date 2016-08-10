
/**
 * Created by gitbong on 1/21/16.
 */
(function (n_, fn_) {
	if (typeof define === 'function' && define.amd) {
	} else {
		window[n_] = window[n_] || {};
		window[n_].module = fn_();
	}
})('gb', function () {
	var app = {
		$view: -1,
		name: -1
	};
	var moduleMap = {};
	var ctrl2CtrlMap = {};
	var _root;

	window.m = moduleMap;

	//entry
	function _initApp() {
		app.$view = $('[gb-app]').eq(0);
		app.name = app.$view.attr('gb-app');
		app.module = moduleMap[app.name].ins;
		if (app.name == null)return;

		moduleMap[app.name].ins.service('_$ctor', function () {
			this.name = '_$ctor';
		});
		moduleMap[app.name].deps.push('gbRouter');
		moduleMap[app.name].deps.push('gbTool');
		moduleMap[app.name].deps.push('gbScope');

		_root = _regModule('_root', [app.name, 'gbRouter', 'gbDom', 'gbScope'], function (_$ctor, $router, _$dom, _$scopeMgr) {
			/**
			 * _$dom
			 */
			var preTplScope;
			var currTplScope;
			_$dom.tplAddedSignal.add(function (ctrlName, $view, isLoading) {
				_$scopeMgr.createScope(ctrlName, $view, isLoading);
				currTplScope = _$scopeMgr._getScope(ctrlName);
				setTimeout(function () {
					if (preTplScope != null) {
						preTplScope.onRemove({
							preHash: $router.preHash,
							currHash: $router.currHash,
							data: $router._gotoData
						});
						currTplScope._ctor();
					} else {
						currTplScope._ctor();
					}
				}, 50);
				if (moduleMap[app.name].cMap[ctrlName] == null)
					throw ('Do not have controller named "' + ctrlName + '"');
				moduleMap[app.name].cMap[ctrlName].scopeName = '$scope_' + ctrlName;
				moduleMap[app.name].ins.cMap[ctrlName].scopeName = '$scope_' + ctrlName;
				if (isLoading) {
					var loadingDeps = moduleMap[app.name].cMap[ctrlName].deps;
					for (var i in loadingDeps) {
						if (loadingDeps[i] == '$scope_' + ctrlName) {
							moduleMap[app.name].cMap[ctrlName].deps[i] = '_$scopeLoading';
							moduleMap[app.name].ins.cMap[ctrlName].deps[i] = '_$scopeLoading';
							moduleMap[app.name].cMap[ctrlName].scopeName = '_$scopeLoading';
							moduleMap[app.name].ins.cMap[ctrlName].scopeName = '_$scopeLoading';
						}
					}
					_root.controller('_loadingHandler', function (_$scopeLoading) {
						_$scopeLoading.closeSignal.add(function () {
							_$dom.addTpl($router.getTplConfig($router.currHash));
						});
					}, true);
				} else {
					ctrl2CtrlMap[$router.currHash] = ctrlName;
				}
				app.module._createC(ctrlName);
			});
			/**
			 * $router
			 */
			$router._start();
			$router.changeSignal.add(function (preHash, currHash) {
				preTplScope = _$scopeMgr._getScope(ctrl2CtrlMap[preHash]);
				//preTplScope.onRemove({preHash: $router.preHash, currHash: $router.currHash, data: $router._gotoData});
				_$dom.addTpl($router.getTplConfig($router.currHash));
			});
			if ($router.haveLoading && $router.getDefaultLibs().length > 0) {
				_$dom.addLoading($router.getLoadingConfig(), $router.getTplConfig($router.currHash));
			} else {
				_$dom.addTpl($router.getTplConfig($router.currHash));
			}
		});
		_runModule('_root');
	}

	function _regModule(mName, deps, fn) {
		var mIns = new ModuleClass(mName);
		moduleMap[mName] = {name: mName, deps: deps, fn: fn, ins: mIns, hasRun: false, cMap: {}, sMap: {}};
		return mIns;
	}

	function _runModule(mName) {
		var mCfg = moduleMap[mName];
		var mIns = mCfg.ins;
		mIns._run(mCfg.fn);
	}

	/**
	 * module class
	 * @constructor
	 */
	function ModuleClass(mName) {
		var sf = this;
		sf.cMap = {};
		sf.sMap = {};
		sf.runMap = [];

		sf.name = mName;
		sf.controller = function (name, fn, autoRun) {
			sf.cMap[name] = {name: name, fn: fn, deps: _getDepends(fn, name), ins: null, type: "C"};
			moduleMap[sf.name].cMap[name] = sf.cMap[name];
			if (autoRun)sf._createC(name);
			return sf;
		};
		sf.service = function (name, fn) {
			sf.sMap[name] = {name: name, fn: fn, deps: _getDepends(fn, name), ins: null, type: "S"};
			moduleMap[sf.name].sMap[name] = sf.sMap[name];
			return sf;
		};
		sf.factory = function (name, fn) {
			sf.sMap[name] = {name: name, fn: fn, deps: _getDepends(fn, name), ins: null, type: "F"};
			moduleMap[sf.name].sMap[name] = sf.sMap[name];
			return sf;
		};
		sf.run = function (fn) {
			sf.runMap.push(fn);
			return sf;
		};
		sf.getService = function (name) {
			if (moduleMap[sf.name].hasRun == false)_runModule(sf.name);
			var s = sf._createS(name);
			return s;
		};
		sf._run = function (ctorFn) {
			if (moduleMap[sf.name].hasRun)return;
			if (ctorFn != null)sf.runMap.unshift(ctorFn);
			for (var i in sf.runMap) {
				sf.controller('_run_' + sf.name + '_' + i, sf.runMap[i]);
			}
			for (var j in sf.runMap) {
				sf._createC('_run_' + sf.name + '_' + j);
			}
			moduleMap[sf.name].hasRun = true;
		};
		sf._createC = function (name) {
			var cCfg = sf.cMap[name];
			if (cCfg == null)return;
			cCfg.ins = this._newServiceIns(cCfg);
		};
		sf._createS = function (name) {
			var sCfg = sf.sMap[name];
			if (sCfg == null) {
				var deps = moduleMap[sf.name].deps;
				for (var i in deps) {
					var mName = deps[i];
					if (moduleMap[mName] != null) {
						for (var j in moduleMap[mName].sMap) {
							if (name == j) {
								var s = moduleMap[mName].ins.getService(name);
								return s;
							}
						}
					} else {
						return null;
					}
				}
				return null;
			} else {
				if (sCfg.type == "S") {
					if (sCfg.ins == null) {
						sCfg.ins = this._newServiceIns(sCfg);
						if (sCfg.ins._ctor != null) {
							sCfg.ins._ctor();
						}
						return sCfg.ins;
					} else {
						return sCfg.ins;
					}
				} else if (sCfg.type == "F") {
					if (sCfg.hasRun == true) {
						return sCfg.return;
					} else {
						sCfg.return = sCfg.fn();
						sCfg.hasRun = true;
						return sCfg.return;
					}
				}
			}
		};
		sf._newServiceIns = function (cfg) {
			var name = cfg.name;
			var deps = cfg.deps;
			var fn = cfg.fn;

			var fnStr = "";
			for (var i in deps) {
				if (deps[i] == name) {
					fnStr += "null,"
				} else {
					fnStr += "this._createS('" + deps[i] + "'),";
				}
			}
			fnStr = fnStr.substring(0, fnStr.length - 1);
			var ins = eval("new " + "fn" + "(" + fnStr + ")");
			return ins;
		};
	}

	function _getDepends(fn_, ctrlName) {
		var deps = fn_.toString().match(/^function\s*[^\(]*\(\s*([^\)]*)\)/m)[1].replace(/ /g, '').split(',');
		if (deps.length == 1 && deps[0] == "")
			deps = [];
		for (var i in deps) {
			if (deps[i] == '$scope')
				deps[i] = "$scope_" + ctrlName;
		}
		return deps;
	}

	$(_initApp);
	return _regModule;
});
/**
 * Created by gitbong on 1/21/16.
 */
(function () {
	var _gbTool = gb.module('gbTool', []);
	_gbTool.service('$libsLoader', function () {
		var imgMap = {};
		var img = new Image();
		this.load = function (arr_, progressFn_, completeFn_) {
			var libs = typeof arr_ == 'string' ? [arr_] : arr_;
			_loadImgs(libs, progressFn_, completeFn_);
		};
		function _loadImgs(arr_, progressFn_, completeFn_) {
			var imgNum = arr_.length;
			var i = 0;
			var progress = 0;
			if (imgNum == 0) {
				if (progressFn_)
					progressFn_(1);
				if (completeFn_)
					completeFn_();
				return;
			}
			var timer = setInterval(function () {
				progress += ( Math.abs(i / imgNum * 100) - progress) * .3;
				progress = Math.floor(progress);
				if (progressFn_) {
					progressFn_(progress);
				}
				if (progress >= 92) {
					progress = 100;
					if (progressFn_)
						progressFn_(progress);
					if (completeFn_)
						completeFn_(progress);
					clearInterval(timer);
				}
			}, 1000 / 60);
			if (imgNum > 0) {
				setSrc();
			}
			function setSrc() {
				var url = arr_[i];
				// console.log(imgMap);
				if (imgMap[url] != 1) {
					// console.log(url)
					if (url.indexOf('.css') == -1) {
						img.onload = function () {
							i++;
							imgMap[url] = 1;
							if (i == arr_.length) {
							} else {
								setSrc();
							}
						};
						img.src = url;
					} else {
						$.ajax({
							url: url, success: function (data) {
								i++;
								imgMap[url] = 1;
								if (i == arr_.length) {
								} else {
									setSrc();
								}
								if (window.__gbTplData__ != null) {
									$('<style>' + data + '</style>').appendTo('head');
								} else {
									$('<link rel="stylesheet" href="' + url + '"/>').appendTo('head');
								}
							}
						});
					}
				} else {
					i++;
					if (i < imgNum)
						setSrc();
				}
			}
		}

		this.loadCSS = function () {

		};
	});
	_gbTool.factory('$Signal', function () {
		function Signal() {
			var map = [];
			this.add = function (fn, scope) {
				map.push({fn: fn, scope: scope, addOnce: false, isDestroyed: false});
			};
			this.addOnce = function (fn, scope) {
				map.push({fn: fn, scope: scope, addOnce: true, isDestroyed: false});
			};
			this.dispatch = function () {
				for (var i in map) {
					var fn = map[i].fn;
					var scope = map[i].scope;
					var addOnce = map[i].addOnce;
					var isDestroyed = map[i].isDestroyed;
					if (!isDestroyed)
						fn.apply(scope, arguments);
					if (addOnce)
						map[i].isDestroyed = true;
				}
			}
		}

		return Signal;
	});
	_gbTool.service('$htmlLoader', function () {
		var self = this;
		var htmlMap = {};

		function _getFileName(url) {
			var arr = url.split('/');
			return arr[arr.length - 1];
		}

		self.load = function (url_, fn_) {
			if (window.__gbTplData__ != null) {
				for (var i in window.__gbTplData__) {
					if (_getFileName(i) == _getFileName(url_)) {
						//if (i.indexOf(url_) != -1) {
						htmlMap[_getFileName(url_)] = window.__gbTplData__[i];
						if (fn_)fn_(window.__gbTplData__[i]);
						break;
					}
				}
			} else {
				if (htmlMap[_getFileName(url_)] == null) {
					$.ajax({
						url: url_,
						dataType: 'html',
						type: 'GET',
						success: function (html_) {
							htmlMap[_getFileName(url_)] = html_;
							if (fn_)fn_(html_);
						}
					});
				} else {
					if (fn_)fn_(self.getHtml(url_));
				}
			}
		};
		self.getHtml = function (url_) {
			return htmlMap[_getFileName(url_)];
		};
	});
})();
/**
 * Created by gitbong on 1/21/16.
 */
(function () {
	gb.module('gbRouter', ['gbTool'], function () {

		})
		.service('$router', function ($Signal) {
			var sf = this;

			var defaultRouter;
			var tplConfig = {};
			var loadingConfig = {};
			var tplList = [];
			var useVirtualRouter = false;

			this.startSignal = new $Signal();
			this.changeSignal = new $Signal();
			this._gotoData;

			var hashMgr = {
				_hash: '',
				addListener: function (fn) {
					window.addEventListener('hashchange', function () {
						hashMgr._hash = window.location.hash.split('?')[0];
						fn();
					});
				},
				hash: function (v) {
					if (useVirtualRouter) {
						if (v == null) {
							return hashMgr._hash;
						} else {
							if (v != hashMgr._hash) {
								hashMgr._hash = v;
								_onHashChange();
							}
						}
					} else {
						if (v == null) {
							return window.location.hash.split('?')[0];
						} else {
							if (v != hashMgr._hash) {
								hashMgr._hash = v;
								window.location.hash = v;
								_onHashChange();
							}
						}
					}
				}
			};

			function _init() {
				hashMgr.addListener(_onHashChange);
				//window.addEventListener('hashchange', function () {
				//	_onHashChange();
				//});
			}

			//sf.preHash = null;
			//sf.currHash = hashMgr.hash();
			//sf.isStart = false;
			//sf.haveLoading = false;

			//console.log(sf);

			function _onHashChange() {
				sf.preHash = sf.currHash;
				sf.currHash = hashMgr.hash();
				//sf.currHash = window.location.hash;
				if (tplConfig[sf.currHash] == null) {
					hashMgr.hash('#' + defaultRouter);
					//window.location.hash = '#' + defaultRouter;
					sf.currHash = sf.preHash;
				} else {
					if (sf.preHash != sf.currHash) {
						sf.changeSignal.dispatch(sf.preHash, sf.currHash);
					}
				}
			}

			sf.getTplConfig = function (hash) {
				if (tplConfig[hash] != null) {
					return tplConfig[hash].config;
				} else {
					return tplConfig['#' + defaultRouter].config;
				}
			};

			sf.preHash = null;
			sf.isStart = false;
			sf.haveLoading = false;

			sf._start = function () {
				if (sf.isStart) return;

				sf.currHash = hashMgr.hash();

				_init();
				var tplCfg = tplConfig[sf.currHash];
				if (tplCfg == null || tplCfg.config.asIndex == false) {
					sf.currHash = '#' + defaultRouter;
					hashMgr.hash(sf.currHash);
					//window.location.hash = sf.currHash;
				}
				sf.isStart = true;
				sf.startSignal.dispatch();
			};
			sf.getDefaultLibs = function () {
				var libs = tplConfig[sf.currHash].config.libs ? tplConfig[sf.currHash].config.libs : [];
				return libs;
			};
			sf.goto = function (rount_, data_) {
				sf._gotoData = data_;
				hashMgr.hash("#" + rount_);
				//window.location.hash = "#" + rount_;
			};
			sf.when = function (router_, config_) {
				config_.id = router_;
				tplConfig['#' + router_] = {hash: "#" + router_, config: config_, isOpen: 0};
				tplList.push(router_);
				return sf;
			};
			sf.other = function (router) {
				defaultRouter = router;
				return sf;
			};
			sf.loading = function (config_) {
				sf.haveLoading = true;
				config_.id = 'default-loading';
				loadingConfig = {config: config_, isOpen: 0};
				return sf;
			};
			sf.getHash = function () {
				return hashMgr.hash();
			};
			sf.useVirtualRouter = function (use_) {
				useVirtualRouter = use_;
				return sf;
			};
			sf.getLoadingConfig = function () {
				return loadingConfig.config;
			};
		});
})();
/**
 * Created by gitbong on 1/21/16.
 */
(function () {
	gb.module('gbDom', ['gbTool'], function () {

	}).service('_$dom', function ($Signal, $htmlLoader) {
		var $app = $('[' + 'gb-app' + ']');
		var self = this;
		self.tplAddedSignal = new $Signal;

		self.addLoading = function (loadingTplCfg, libs) {
			libs = libs == null ? [] : libs;
			self.addTpl(loadingTplCfg, true);
		};
		self.addTpl = function (tplCfg, isLoading) {
			var url = tplCfg.tpl;
			$htmlLoader.load(url, function (html) {
				var $domE = $(html);
				var ctrlName = $domE.attr('gb-controller');
				$app.append($domE);
				$domE.hide();
				self.tplAddedSignal.dispatch(ctrlName, $domE, isLoading);
			});
		};
		function _init() {
			document.addEventListener('DOMNodeInserted', function (e) {
				return;
				console.log('#domchange:', e.target.outerHTML);
				var $domE = $(e.target.outerHTML);
				$domE.css('opacity', .3);
				self.tplAddedSignal.dispatch($domE);
			}, false);
			document.addEventListener('DOMNodeRemoved', function (e) {
			}, false);
			document.addEventListener('DOMAttrModified', function () {
			}, false);
		}

		_init();
	});
})();

var arr = [function ($scope) {

}];
/**
 * Created by gitbong on 1/21/16.
 */
(function () {
	var _gbScope = gb.module('gbScope', ['gbTool', 'gbRouter'], function () {

	}).service('_$scopeMgr', function ($libsLoader, $router, $Signal) {
		var mgr = this;
		var ctrl2ScopMap = {};
		mgr._loadingCtrlName = '';
		mgr._getScope = function (cName) {
			var scopeName = ctrl2ScopMap[cName];
			return _gbScope._createS(scopeName);
		};
		mgr.createScope = function (cName, $view, isLoading) {
			var scopeName = isLoading ? "_$scopeLoading" : ('$scope_' + cName);
			ctrl2ScopMap[cName] = scopeName;
			_gbScope.service(scopeName, function ($router) {
				var sf = this;
				sf.$view = $view.hide();
				if (isLoading) {
					mgr._loadingCtrlName = cName;
					sf.onLibsProgress = function (p) {
					};
					sf.onLibsComplete = function () {
					};
					sf.loadLibs = function () {
						$libsLoader.load($router.getDefaultLibs(), sf.onLibsProgress, function () {
							sf.onLibsComplete();
						});
					};
					sf.closeLoading = function () {
						sf.closeSignal.dispatch();
						sf.onRemove();
						setTimeout(function(){
						},100);
					};
					sf.closeSignal = new $Signal;
				}
				sf.onAdd = function () {
					//sf.add();
				};
				sf.onRemove = function () {
					//sf.remove();
				};
				sf.add = function () {
					sf.$view.show();
				};
				sf.remove = function () {
					sf.$view.remove();
				};
				sf._ctor = function () {
					sf.onAdd({preHash: $router.preHash, currHash: $router.currHash, data: $router._gotoData});
				};

				//_ctor();
			})
		};
	});
})();