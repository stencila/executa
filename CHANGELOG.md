# [0.4.0](https://github.com/stencila/executa/compare/v0.3.1...v0.4.0) (2019-10-23)


### Bug Fixes

* **Browser:** Do not rely on default exports ([295fa60](https://github.com/stencila/executa/commit/295fa6074801b23d6cd8d038fb17e96031008942))
* **CLI:** Remove env var setting ([b9eb0f6](https://github.com/stencila/executa/commit/b9eb0f69ad0716fe32da391488a6f70fb18593a3))


### Features

* **Browser:** Auto fetch manifest & allow setting Executa options ([5c583fb](https://github.com/stencila/executa/commit/5c583fbc6c2ccfe67f75d9676c4b6e55aa33e7f3))
* **Executa:** Add session parameter to execute functions ([7cf0513](https://github.com/stencila/executa/commit/7cf05130e26d2481be1cf72f542e64a6958500ec))
* **TCP & WebSocket severs:** Add onConnected and onDisconnected methods ([f891e53](https://github.com/stencila/executa/commit/f891e536ece4874b5a6dc9bcb72a550023bc70fd))

## [0.3.1](https://github.com/stencila/executa/compare/v0.3.0...v0.3.1) (2019-10-22)


### Bug Fixes

* **CLI:** Add shebang; add `bin` property and change location of log ([e1929e6](https://github.com/stencila/executa/commit/e1929e6256941958a64add5baa57b87b306a55be))

# [0.3.0](https://github.com/stencila/executa/compare/v0.2.0...v0.3.0) (2019-10-21)


### Bug Fixes

* **Dependencies:** Add glob to package.json ([232ccce](https://github.com/stencila/executa/commit/232ccce4e349d85ff6ff96e2eac80d16f745c89a))
* **StdioClient:** pipe stderr to current process stderr ([0c12d40](https://github.com/stencila/executa/commit/0c12d405438e596dd1d6febf2034abcaca0805a2))


### Features

* **Docker:** Add setup for building and testing Dockerfile ([80d4964](https://github.com/stencila/executa/commit/80d4964d4e369f91ded040aa63876f6a489f8ada))
* Add begin and end methods ([074cfa0](https://github.com/stencila/executa/commit/074cfa07551c9465552b1f63efb58e069fe77509))

# [0.2.0](https://github.com/stencila/executa/compare/v0.1.1...v0.2.0) (2019-10-18)


### Bug Fixes

* **CLI:** Handle boolean options properly ([8dfa813](https://github.com/stencila/executa/commit/8dfa8136b1cbac6f046717f395fe92968be69121))
* **Executor:** Add error to code chunk or expr  if unable to delegate execution. ([1660382](https://github.com/stencila/executa/commit/1660382393adc8e208e09d3f2f6d491701bbb582))
* **Executor:** Fix typo in name ([5c3dc5b](https://github.com/stencila/executa/commit/5c3dc5b7f8abd8e977d37798d444935419103c4a))
* **HTTP and WS:** Fix WS auth ([9ab1d5e](https://github.com/stencila/executa/commit/9ab1d5ec880ba0193009285450a936a2c37470a7))
* **HttpServer:** Add CORS ([82b8b2b](https://github.com/stencila/executa/commit/82b8b2becf095c228babf70cfd120c8af35a6510))
* **StdioClient:** Add error handling ([e219f96](https://github.com/stencila/executa/commit/e219f96495e47456cdd819f6db5363f4086ec130))
* **WebSocketAddress:** Use different port for HTTP and WS ([d1eaa4b](https://github.com/stencila/executa/commit/d1eaa4becfa70032b57901061c89733f14af29c8))


### Features

* **HttpServer:** Provide default token at startup ([00ef456](https://github.com/stencila/executa/commit/00ef456b091237d9ce340e613a16d1c5d0dca526))

## [0.1.1](https://github.com/stencila/executa/compare/v0.1.0...v0.1.1) (2019-10-16)


### Bug Fixes

* **Console:** Fix for new Executor constuctor API ([7b4351c](https://github.com/stencila/executa/commit/7b4351c))
* **HttpAddress:** Add path to HttpAddress ([0036afc](https://github.com/stencila/executa/commit/0036afc))
* **WebSocketServer:** Call with correct args ([be87b69](https://github.com/stencila/executa/commit/be87b69))

# 0.1.0 (2019-10-16)


### Bug Fixes

* **Executor:** Do not create new interface if one already created ([c77ae27](https://github.com/stencila/executa/commit/c77ae27))
* **JS Manifest:** Fix programmingLanguage ([ae3d8a6](https://github.com/stencila/executa/commit/ae3d8a6))
* **Server:** Fix method names and params ([0a10d06](https://github.com/stencila/executa/commit/0a10d06))
* **Server:** Fixes for changes in access ([d8ffb99](https://github.com/stencila/executa/commit/d8ffb99))
* Removed JS stub discover in favour of real manifest read ([7286d8e](https://github.com/stencila/executa/commit/7286d8e))
* Transform causing infinite loop when walking ([298704b](https://github.com/stencila/executa/commit/298704b))
* **TCPClient:** Add stop method ([5e82027](https://github.com/stencila/executa/commit/5e82027))
* **TcpServer:** Handle string constuctor and better logging ([029a3dd](https://github.com/stencila/executa/commit/029a3dd))
* **Transports:** Allow for number as port ([ec7dfd3](https://github.com/stencila/executa/commit/ec7dfd3))

### Features

* Added discovery of Python peer from executors dir ([c84d279](https://github.com/stencila/executa/commit/c84d279))
* Added JS executor backend ([93bcd81](https://github.com/stencila/executa/commit/93bcd81))
* **HTTP, Websocket:** Add initial HTTP and Websocket clients and servers ([a1ec214](https://github.com/stencila/executa/commit/a1ec214))
* Added Python backend and TCP server ([dbf6cf7](https://github.com/stencila/executa/commit/dbf6cf7))
* **CLI:** Add initial CLI interface ([bf360c5](https://github.com/stencila/executa/commit/bf360c5))
* **Console:** Add simple console script ([71c33bc](https://github.com/stencila/executa/commit/71c33bc))
* **Executor:** Just-in-time connect to clients ([703c1fe](https://github.com/stencila/executa/commit/703c1fe))
* **Executor:** Walk node tree and delegate; allow for in-process executors ([17cf29f](https://github.com/stencila/executa/commit/17cf29f))
* **HTTP:** Add HTTP discover function ([3f4efef](https://github.com/stencila/executa/commit/3f4efef))
* **HTTP & WebSocket:** Add JSON Web Token authentication ([2e26ff5](https://github.com/stencila/executa/commit/2e26ff5))
* **IPC:** Add client and server classes ([c4b69a7](https://github.com/stencila/executa/commit/c4b69a7))
* **Vsock:** Add initial VsockServer ([26543c1](https://github.com/stencila/executa/commit/26543c1))
* **VsockFirecrackerClient:** Add client to talk to FC microVMs ([8c28b84](https://github.com/stencila/executa/commit/8c28b84))
