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
