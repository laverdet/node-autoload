var fs = require('fs');
var joinPath = require('path').join;

this.autoload = autoload;
this.registeredGlobalsAutoloader = registeredGlobalsAutoloader;
this.scrapeRegisterGlobalSymbols = scrapeRegisterGlobalSymbols;
this.stripComments = stripComments;

/**
 * Typical autoloader. Takes a path and searches for `registerGlobal()` calls in .js files. More
 * specialized autoloaders can be built from this example, but this should be enough for the simple
 * global case.
 */
function registeredGlobalsAutoloader(require) {
	registerGlobal(registerGlobal);
	return {
		pattern: /\.js$/,
		require: function(path) {
			require(path.replace(/\.js$/, ''));
		},
		parse: scrapeRegisterGlobalSymbols,
		scope: global,
	};
}

/**
 * Very naive comment stripping. Extremely buggy, undependable, untested, and flawed by design.
 */
function stripComments(source) {
	return source.replace(/(?:\/{2}.*$)|\/\*[^]*?\*\//gm, '');
}

/**
 * Discover all globals registered via registerGlobal() in a file. This can detect calls of the
 * following patterns:
 *
 *   registerGlobal(MyGlobal);
 *   registerGlobal("MyGlobal", { ... });
 *   registerGlobal(function MyGlobal() { ... });
 *
 * Don't do bullshit like this:
 *
 *   for (var ii in globals) {
 *     registerGlobal(globals[ii]);
 *   }
 */
function scrapeRegisterGlobalSymbols(source, path) {
	// Don't find globals in this file
	if (source.indexOf("this indexOf() call will find itself") !== -1) {
		return [];
	}

	// Find all registerGlobal() calls in this source
	source = stripComments(source);
	var rx = /registerGlobal\((?: *function *)?["']?([a-zA-Z0-9$_]+) *(?:["']?|\)|,)/g;
	var symbols = [];
	for (var match = rx.exec(source); match !== null; match = rx.exec(source)) {
		symbols.push(match[1]);
	}

	// Make sure we didn't miss any registerGlobal()'s
	var count = 0;
	rx = /registerGlobal/g;
	match = rx.exec(source);
	while (match !== null) {
		++count;
		match = rx.exec(source);
	}
	if (count !== symbols.length) {
		throw new Error('Failed to autoload ' + path + ':\n[' + symbols.join(',') + ']');
	}
	return symbols;
}

/**
 * Bring an object or function into global scope. If defining a function, this can take only one
 * argument. In that case, the function's `name` property becomes the name of the global symbol.
 */
function registerGlobal(name, fn) {
	if (arguments.length === 1) {
		if (name instanceof Function) {
			fn = name;
			name = fn.name;
		} else {
			throw new TypeError('Must specify name with non-Function');
		}
	}
	global[name] = fn;
}

/**
 * Traverse source code and install autoload hooks.
 *
 * `loaders` is an array of objects with the following properties:
 * {
 *   pattern: RegExp, // If the file's path does not match this regexp it will not be parsed
 *   require: function(path) {}, // Given a relative path, require it
 *   parse: function(source, path) {}, // Return all symbols a particular file defines
 *   scope: {}, // Scope in which symbols should be defined
 * }
 */
function autoload(root, loaders, ondone) {
	function autoloader(path, ondone) {
		var fullPath = joinPath(root, path);

		fs.stat(fullPath, function(err, stat) {
			if (err) {
				throw new Error(err);
			}
			if (stat.isFile()) {
				// Don't bother reading this file if there's nothing looking for symbols
				var found = false;
				for (var ii = 0; ii < loaders.length; ++ii) {
					if (loaders[ii].pattern.test(path)) {
						found = true;
						break;
					}
				}
				if (!found) {
					return ondone();
				}

				// Read the file from disk to pass to parsers
				fs.readFile(fullPath, 'utf-8', function(err, source) {
					if (err) {
						throw new Error(err);
					}

					for (var ii = 0; ii < loaders.length; ++ii) {
						if (loaders[ii].pattern.test(path)) {
							// Parse and register autoloading loaders
							var symbols = loaders[ii].parse(source, path);
							for (var jj = 0; jj < symbols.length; ++jj) {
								// It's possible the symbol has already been defined, in which case we should avoid
								// clobbering it with the autoloader.
								if (!loaders[ii].scope.hasOwnProperty(symbols[jj])) {
									~function(loader, symbol) {
										Object.defineProperty(loader.scope, symbol, {
											get: function() {
												delete loader.scope[symbol];
												loader.require(path);
												if (loader.scope.hasOwnProperty(symbol)) {
													return loader.scope[symbol];
												} else {
													throw new Error('Failed to autoload ' + symbol);
												}
											},
											set: function(val) {
												delete loader.scope[symbol];
												loader.scope[symbol] = val;
											},
											configurable: true,
											enumerable: true,
										});
									}(loaders[ii], symbols[jj]);
								}
							}
						}
					}

					ondone();
				});

			} else if (stat.isDirectory()) {
				// Descend directory
				fs.readdir(fullPath, function(err, files) {
					if (err) {
						throw new Error(err);
					}
					var remaining = files.length;
					if (!remaining) {
						return ondone();
					}
					for (var ii = 0; ii < files.length; ++ii) {
						if (/^\./.test(files[ii])) {
							if (!--remaining) {
								return ondone();
							}
						} else {
						~function(a) {
							autoloader(joinPath(path, files[ii]), function() {
								if (!--remaining) {
									return ondone();
								}
							});
							}(files[ii]);
						}
					}
				});

			} else {
				// idk
				ondone();
			}
		});
	}
	autoloader(false, ondone);
}
