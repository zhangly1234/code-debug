# proj158-rust-debugger

## 引言

### 项目背景

方便的源代码级调试工具，对监测程序运行状态和理解程序的逻辑十分重要；高效的Rust语言跟踪能力，是Rust操作系统内核开发的必要工具，对基于Rust的操作系统教学和实验很有帮助。然而现有RISC-V、Rust实验环境搭建成本高，上手难度大，不利于学习与开发工作。本项目拟实现一种基于网页访问的在线实验系统，提供方便、高效的手段实现在QEMU和RISC-V开发板上的Rust教学操作系统的源代码调试。

### 相关工作
#### VS Code 中的调试架构
VS Code基于Debug Adapter 协议，实现了一个原生的，非语言相关的调试器UI，它可以和任意后台调试程序通信。通常来讲，gdb等调试器不会实现Debug Adapter 协议，因此需要调试适配器（Debug Adapter）去“适配”这个协议，它一般而言是一个独立和调试器通信的进程。

![](./docs/imgs/debug-arch1.png)


#### Debug Adapter 协议
该协议主要由以下三个部分组成：
##### Events
此部分定义了调试过程中可能发生的事件
##### Requests
此部分定义了VSCode等调试器UI对Debug Adapter的请求
##### Responds
此部分定义了Debug Adapter对请求的回应
#### gdbstub on qemu
QEMU 支持通过远程连接工具访问 QEMU 中的 gdbserver。 这允许以与在真实硬件上使用 JTAG 等低级调试工具相同的方式调试客户代码。 可以停止和启动虚拟机，检查寄存器和内存等状态，并设置断点和观察点。
## 调试工具设计
### 整体架构设计
如下图所示，本调试工具主要分为以下几个模块：

### WebView
在VSCode已有的原生UI之外，本项目通过VSCode提供的WebView，创建一个网页提供更丰富的用户交互界面。用户界面有如下信息显示窗口：

| 名称 	| 功能 	| 更新策略 	|  	|  	|
|---	|---	|---	|---	|---	|
| 寄存器信息 	| 显示寄存器名及寄存器值 	| 触发断点或暂停时更新 	|  	|  	|
| 特权级信息 	| 显示当前特权级 	| 触发断点或暂停时更新 	|  	|  	|
| 内存信息 	| 显示指定位置和长度的内存信息，可增删 	| 触发断点、暂停、用户修改请求的内存信息时更新 	|  	|  	|
| 断点信息 	| 显示当前设置的断点以及暂未设置的，缓存的其他内存空间下的断点（比如在内核态时某用户程序的断点） 	| 触发断点或暂停时更新 	|  	|  	|


用户界面有如下功能按钮：


| 名称 	| 功能 	|  	|  	|  	|
|---	|---	|---	|---	|---	|
| removeDebugFile 	| 去除调试信息文件 	|  	|  	|  	|
| setKernelInOutBreakpoints 	| 设置内核态到用户态，用户态到内核态的边界处的断点 	|  	|  	|  	|
| removeAllCliBreakpoints 	| 重置按钮。清空编辑器，Debug Adapter, GDB中所有断点信息 	|  	|  	|  	|
| disableCurrentSpaceBreakpoints 	| 令GDB清除当前设置的断点且不更改Debug Adapter中的断点信息 	|  	|  	|  	|
| updateAllSpacesBreakpointsInfo 	| 手动更新断点信息表格 	|  	|  	|  	|


WebView和插件进程互相传递消息。具体见src/frontend/extension.ts。
### 插件进程
见见src/frontend/extension.ts。插件进程发送Requests(包括customRequest)给Debug Adapter并接收Debug Adapter发送的Response和Events
### Debug Adapter

本项目使用一个独立进程作为Debug Adapter。本项目主要增加了涉及操作系统调试的处理流程。
见src/mibase.ts

### 涉及操作系统调试的处理流程
#### 消息类型

根据Debug Adapter 协议。本项目主要使用以下三个传递信息的途径：

- Requests：各类消息请求的格式。本项目通过其中的CustomRequests扩展了一些操作系统调试相关的请求。
- Response：对于Requests的响应。
- Events：Debug Adapter事件。Events和Response都能向插件进程返回数据。
#### 当前特权级检测
RISC-V处理器没有寄存器可以透露当前的特权级，因此本项目在内核代码中，内核态进入用户态以及用户态返回内核态处各设置一个断点，断点被触发时更新特权级信息。
此外再辅以当前执行的代码的文件名，内存地址空间等手段判断当前的特权级。
#### 特权级变化时的处理
##### 切换断点
如果同时令GDB设置内核态和用户态代码的断点，会导致这些断点全部失效（推测是因为执行sfence.vma指令之后，TLB刷新成用户进程的页表，导致内核地址空间的断点无法被设置）。因此，rCore运行在内核态时GDB只能设置内核态的断点，用户态同理。本项目为了方便用户进行用户态程序的调试，跟踪系统调用，如果用户在内核态时设置了用户态的断点，这个断点的信息会被存储在Debug Adapter中，特权级发生变化时自动令GDB删除旧断点，并设置之前缓存下来的断点。
在Debug Adapter中，断点被分为很多组，根据不同情况可以切换不同组的断点。
##### 切换符号表
特权级切换时自动切换到对应的用户态程序的符号表文件。
具体见src/mibase.ts



### GDB/MI Interface

GDB/MI是GDB面向机器的、基于行的文本接口。它用于支持将调试器作为Debugger插件的一个小模块来使用的系统开发。本项目将用户请求（Debug Adapter Requests）转换为符合GDB/MI接口规范的文本并通过管道发送给GDB进程。GDB进程同样返回符合GDB/MI接口规范的文本数据。


### GDB和Qemu虚拟机
Qemu虚拟机运行rCore-Tutorial操作系统，本项目中Qemu开启了gdbstub功能，该功能开启一个gdbserver，本地的gdb通过tcp协议连接gdbserver




## 调试工具实现
### 常用API、GDB命令
![](./docs/imgs/new-Coredebugger-APIs.png)
#### WebView <==> 插件进程
- 插件进程 --> WebView
    ```ts
    currentPanel.webview.postMessage({ breakpointsInfo: message.body.data });
    ```
- WebView --> 插件进程
    ```ts
    vscode.postMessage({removeAllCliBreakpoints:true});
    ```
- 弹出消息窗口
    ```ts
    vscode.window.showInformationMessage("message"):
    ```
详见`src/frontend/extension.ts`
#### 插件进程 <==> Debug Adapter
1. 插件进程 --> Debug Adapter
    ```ts
    vscode.debug.activeDebugSession?.customRequest("requestName");
    ```
2. Debug Adapter解析customRequest
    ```ts
    protected customRequest(command: string, response: DebugProtocol.Response, args: any): void {
        switch (command) {
            case "requestName":
            this.sendEvent({ event: "eventName", body: ["test"] } as DebugProtocol.Event);
            this.sendResponse(response);
            break;
    ```
3. 插件进程监听Events和Responses
    ```ts
    	let disposable = vscode.debug.registerDebugAdapterTrackerFactory("*", {
		createDebugAdapterTracker() {
			return {
				//监听VSCode即将发送给Debug Adapter的消息
				onWillReceiveMessage:(message)=>{
				    //...   	
				},
				onWillStartSession: () => { console.log("session started") },
				//监听Debug Adapter发送给VSCode的消息
				onDidSendMessage: (message) => {
                    //...
					if (message.type === "event") {
						//...
						}//处理自定义事件
						else if (message.event === "eventTest") {
							//Do Something
						}
						else if (message.event === "updateRegistersValuesEvent") {
							//向WebView传递消息
							currentPanel.webview.postMessage({ regValues: message.body });
                            //...
    ```

详见`src/frontend/extension.ts`、`src/mibase.ts`
#### Debug Adapter <===> Backend
以setBreakPointsRequest为例：
```ts
    // src/mibase.ts
	//设置某一个文件的所有断点
	protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
        //clearBreakPoints()、addBreakPoint() 实现见src/backend/mi2/mi2.ts
		this.miDebugger.clearBreakPoints(args.source.path).then(() => { //清空该文件的断点
            //......
			const all = args.breakpoints.map(brk => {
				return this.miDebugger.addBreakPoint({ file: path, line: brk.line, condition: brk.condition, countCondition: brk.hitCondition });
			});
            // ......
			
```
详见src/mibase.ts



#### GDB命令
- `add-symbol-file`
- `break-insert -f`

详细的输出及返回数据的格式可参考[官方文档](https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI.html#GDB_002fMI)


### 关键的寄存器和内存的数据获取
1. `stopped`事件发生时，通过customRequest请求Debug Adapter返回寄存器信息,内存数据
```ts
    //extension.ts
    //...
    if (message.type === "event") {
        //如果（因为断点等）停下
        if (message.event === "stopped") {

            //请求寄存器信息
            vscode.debug.activeDebugSession?.customRequest("registersNamesRequest");
            vscode.debug.activeDebugSession?.customRequest("registersValuesRequest");

            //请求内存数据
            webviewMemState.forEach(element => {
                vscode.debug.activeDebugSession?.customRequest("memValuesRequest",element);
            });
            //更新WebView中的断点信息
            vscode.debug.activeDebugSession?.customRequest("listBreakpoints");
        }
    //...
```

2. Debug Adapter响应这些请求(见src/mibase.ts/-MI2DebugSession-customRequest)并返回Responses和Events

3. 插件进程接收并解析Responses和Events，将信息传递到WebView
```ts
    //extension.ts
    //处理customRequest
    else if (message.event === "updateRegistersValuesEvent") {
        //向WebView传递消息
        currentPanel.webview.postMessage({ regValues: message.body });
    }
    else if (message.event === "updateRegistersNamesEvent") {
        currentPanel.webview.postMessage({ regNames: message.body });
    }
    //...
```
4. WebView收到信息，更新网页
```ts
    //extension.ts-getWebviewContent()
    window.addEventListener('message', event => {//接受消息
            const message = event.data; // The JSON data our extension sent
            if(message.regValues){//如果是寄存器值信息
                //更新网页
                document.getElementById('regTable').innerHTML="";
                document.getElementById('regTable').innerHTML+=JSON.stringify(message.regValues);
            //...
            }
```
### 断点检测与切换
1. 当增删断点或`stopped`事件发生时，向Debug Adapter请求当前所有的断点信息（以及哪些断点被设置，哪些被缓存）
```ts
    //extension,ts
    onDidSendMessage: (message) => {
        if (message.command === "setBreakpoints"){//如果Debug Adapter设置了一个断点
            //更新WebView中的断点信息
            vscode.debug.activeDebugSession?.customRequest("listBreakpoints");
        }
        if (message.type === "event") {
            //...
            //如果（因为断点等）停下
            if (message.event === "stopped") {
                //更新WebView中的断点信息
                vscode.debug.activeDebugSession?.customRequest("listBreakpoints");   
            }
    //...
```

2. 当用户设置新断点时，判断这个断点能否在当下就设置，若否,则保存（VSCode编辑器和DA的断点是分离的，Debug Adapter不能控制编辑器的断点，故采用这种设计。见[此](https://stackoverflow.com/questions/55364690/is-it-possible-to-programmatically-set-breakpoints-with-a-visual-studio-code-ext)）

```ts
//src/mibase.ts-MI2DebugSession-setBreakPointsRequest
	//设置某一个文件的所有断点
	protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
		this.miDebugger.clearBreakPoints(args.source.path).then(() => { //清空该文件的断点
            //...
			//保存断点信息，如果这个断点不是当前空间的（比如还在内核态时就设置用户态的断点），
			//就暂时不通知GDB设置断点
			let spaceName = this.addressSpaces.pathToSpaceName(path);
			if (spaceName!==this.addressSpaces.getCurrentSpaceName()){
                //弹出提示窗口
				this.sendEvent({event:"showInformationMessage",body:"Breakpoints Not in Current Address Space. Saved"} as DebugProtocol.Event);
                //保存断点信息
				this.addressSpaces.saveBreakpointsToSpace(args,spaceName);
				return ;
			}else{//如果这个断点在当前地址空间内，那么保存断点信息并设置断点
				this.addressSpaces.saveBreakpointsToSpace(args,spaceName);
			}
			
			const all = args.breakpoints.map(brk => {
                //令GDB设置断点
				return this.miDebugger.addBreakPoint({ file: path, line: brk.line, condition: brk.condition, countCondition: brk.hitCondition });
			});
			//...
        //更新断点信息
		this.customRequest("listBreakpoints",{} as DebugAdapter.Response,{});
	}
```

3. 当断点组切换（比如从内核态进到用户态），令GDB移除旧断点（断点信息仍然保存在`MIDebugSession.AddressSpaces.spaces`中），设置新断点。见`src/mibase.ts-AddressSpaces-updateCurrentSpace`。

### 到达内核边界时的处理

1. 触发断点时，检测这个断点是否是内核边界的断点。
```ts
    //src/mibase.ts 
    protected handleBreakpoint(info: MINode) {
        //...
        if (this.addressSpaces.pathToSpaceName(info.outOfBandRecord[0].output[3][1][4][1])==='kernel'){//如果是内核即将trap入用户态处的断点
            this.addressSpaces.updateCurrentSpace('kernel');
            this.sendEvent({ event: "inKernel" } as DebugProtocol.Event);
            if (info.outOfBandRecord[0].output[3][1][3][1] === "src/trap/mod.rs" && info.outOfBandRecord[0].output[3][1][5][1] === '135') {
                this.sendEvent({ event: "kernelToUserBorder" } as DebugProtocol.Event);//发送event
            }
        }
        //...
    }
```
2. 若是，添加符号表文件，移除当前所有断点，加载用户态程序的断点，更新WebView信息。
```ts
    //src/frontend/extension.ts
    //接收event
    //到达内核态->用户态的边界
    else if (message.event === "kernelToUserBorder") {
        //...
        //添加用户态程序的符号表文件
        vscode.debug.activeDebugSession?.customRequest("addDebugFile", { debugFilepath: os.homedir() + "/rCore-Tutorial-v3/user/target/riscv64gc-unknown-none-elf/release/"+userDebugFile });
        //更新断点组
        vscode.debug.activeDebugSession?.customRequest("updateCurrentSpace","src/bin/"+userDebugFile+".rs");
        //向WebView发送更新信息
        currentPanel.webview.postMessage({ kernelToUserBorder: true });
        //...
    }
```

### 符号信息的获取
以下涉及的所有修改[见此](./docs/rCore-mod.diff)
#### 编译
通过修改`Cargo.toml`里的`debug=true`，`opt-level=0`两个参数使得rust编译器在编译时保留DWARF信息。
#### rCore的修改
rCore-Tutorial为了提升性能，在用户程序链接脚本`linker.ld`里面discard了`.debug_info`等段，修改链接脚本可以让链接器不忽略这些调试信息段。但这导致easy-fs的崩溃和栈溢出，故还需将easy-fs-fuse打包程序的磁盘大小，和栈空间改大。此外，user/目录要先 make clean 再编译，修改过的linkerscript才会生效。

### 界面美化

运用bootstrap等前端技术，提供对用户更加友好的图形界面：
![coredebugger-screenshot-bootstrap-mid](./docs/imgs/coredebugger-screenshot-bootstrap-mid.png)

## 总结与展望

项目的主要工作：

1. 在VSCode编辑器的已有debugger插件基础上，扩展对Rust语言和操作系统内核特征的源代码级跟踪分析能力。主要包括：
    - 关键的寄存器和内存的数据获取；
    - 当前特树级信息的准确获取；
    - 函数调用栈跟踪；
    - 一个例子：在USM三态修改符号表，并获取内存单元信息；
    - 对被跟踪内核运行环境的适配：QEMU

2. 通过docker容器提供在线版本vscode、rust工具链以及qemu-system-riscv64等调试rCore-Tutorial-v3所需要的工具，使用户可通过网页远程调用云端qemu/RISC-V开发板的gdb调试器进行代码跟踪与调试。该部分已基本完成，见docker文件夹。待debugger插件功能稳定后上传docker hub。

todos:
- 支持展示更多内核数据结构，比如进程控制块
- 上传到VSCode插件商店
- 对多进程提供更好的支持
- 改用地址空间来判断当前特权级
- 多处理机支持
- 不用WebView，改用TreeView
- 整理代码，抽象出项目核心，移植到vim/emacs......
- 支持watchpoint
- 支持真实硬件
- 在边界时如需自动切换符号文件，那么需要知道切换到哪个用户态程序。但是，我们只有在用户态程序的断点被触发之后，才能知道切换到哪个用户态程序。所以我建议这个功能不做了，改成用户手动设置符号表文件，想看哪个用户态程序就加载哪个用户态程序的符号表文件。在现在版本的代码中，仍然自动切换到initproc。
- 用户程序现在没开opt-level=0,感兴趣的同学可以试试能不能打开


## 安装与使用
### 安装-方法1
vmware虚拟磁盘：(vmware需16.2.3及以上版本)
```
链接：https://pan.baidu.com/s/1KgNGT_kuGNwBrYI6LFK4qg?pwd=1234 
提取码：1234 
```
用户名oslab，密码是一个空格
注意修改下git的用户名和邮箱
### 安装-方法2
1. 推荐用ubuntu20.04虚拟机。其它版本请确保使用较新的`npm`和`node`。
1. 获取risc-v工具链
在[sifive官网](https://www.sifive.com/software)下载risc-v工具链（往下拉找到GNU Embedded Toolchain — v2020.12.8, 下载ubuntu版本），
或者试试直接访问
[这里](https://static.dev.sifive.com/dev-tools/riscv64-unknown-elf-gcc-8.3.0-2020.04.1-x86_64-linux-ubuntu14.tar.gz)。下载后将该文件复制到home目录下。
1. 参考[rCore指导书](https://rcore-os.github.io/rCore-Tutorial-Book-v3/chapter0/5setup-devel-env.html)配置rCore-Tutorial的环境。确保gdb和qemu在环境变量里。
1. 用nodesource安装nodejs 
1. 安装 vscode
1. 修改rCore-Tutorial-v3的源码和编译参数（diff文件可用vscode+diff插件观看）：[见此](./docs/rCore-mod.diff)
1. 在os,user,easy-fs-fuse,easy-fs目录下make clean，如果命令不存在就cargo clean(此举是为了让linker.ld的更改生效)
1. clone 本仓库，在仓库目录下`npm install`
1. 按f5启动插件
1. 修改src/frontend/fakeMakefile.ts里的`PROJECT_PATH`
1. 创建launch.json（选GDB）（可根据自己需要修改）: 
1. 确保/src/mibase.ts/-MI2DebugSession-customRequest方法-case setKernelInOutBreakpoints中硬编码的文件名和行数指向rCore代码中内核的出入口
```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "gdb",
            "request": "attach",
            "name": "Attach to Qemu",
            "executable": "此处修改为rCore-Tutorial-v3所在目录/rCore-Tutorial-v3/os/target/riscv64gc-unknown-none-elf/release/os",
            "target": ":1234",
            "remote": true,
            "cwd": "${workspaceRoot}",
            "valuesFormatting": "parseText",
            "gdbpath": "此处修改为工具链所在目录/riscv64-unknown-elf-toolchain-10.2.0-2020.12.8-x86_64-linux-ubuntu14/bin/riscv64-unknown-elf-gdb",
            "showDevDebugOutput":true,
            "internalConsoleOptions": "openOnSessionStart",
            "printCalls": true,
            "stopAtConnect": true
        },
    ]
}

```

### 使用
1. 在code-debug文件夹下`git pull`更新软件仓库
1. 在打开的新窗口内`Ctrl+Shift+P`找到并点击`CoreDebugger:Launch Coredebugger`
1. 清除所有断点（removeAllCliBreakpoints按钮）
1. 设置内核入口、出口断点（setKernelInOutBreakpoints按钮）
1. 设置内核代码和用户程序代码的断点（推荐initproc.rs的println!语句）
1. 按continue按钮开始运行rCore-Tutorial
1. 当运行到位于内核出口的断点时，插件会自动切换到用户态的断点
1. 在用户态程序中如果想观察内核内的执行流，应先disableCurrentSpaceBreakpoints，设置内核入口、出口断点（setKernelInOutBreakpoints按钮），再设置内核断点

[视频演示](./docs/imgs/pre-2022-07-24.mp4)
### 功能

#### 跟踪系统调用
用户->内核->用户

#### 跟踪内核数据结构
注：内核中的各种数据结构差异很大。此处列出可行的示例，欢迎感兴趣的大佬们继续添加
#### 直接观测内存
Ctrl+Shift+P memory
TODO MemState 代码可以删掉
#### 断点组的自动切换

### 暂不可跟踪
#### Self变量
这是gdb的bug，见https://sourceware.org/gdb/onlinedocs/gdb/Rust.html

#### lazy_static! 变量（宏，返回值，难以跟踪）。如PCB,TCB
找到原因了。和lazy_static宏有关。简单来说，TASK_MANAGER结构体里确实只有__private_filed。TASK_MANAGER里的值通过宏里的deref()函数返回。函数返回值跟踪起来很麻烦，所以曲线救国，把TaskManager的地址复制到另一个全局变量里（这在c里很容易做到，在rust里略麻烦）。
不靠谱的方法：

#### 包含Vec和VecDeque的数据结构
Vec和VecDeque的pointer值通过gdb查看是错的（都是0x1,0x2之类的很小的值）。直接看内存可以得到正确结果
#### 被内联展开的函数

## 扩展
以下列出一些思路，结合[上文](#调试工具实现)，您可以容易地扩充本插件的功能：
### 支持其他OS
	- 获取符号表信息（例如vmlinux）
	- 确定内核“出入口”断点
### 观察其他内核数据结构
1. `stopped`(extension.ts)
1. 添加`customRequest`(mibase.ts)
    1. 收集数据：GDB命令（mi2.ts中的方法，或者直接用this.miDebugger.sendCliCommand）
    1. 返回信息：Events/Responses
1. 插件进程解析Events/Responses并转发至WebView（extension.ts）
1. 添加WebView界面(extension.ts)

### Multiple Debug File Support
1. `vscode.debug.activeDebugSession?.customRequest("addDebugFile`
2. memState into addressspaces
3. GDB Command：`add-file`
### Send GDB Command
1. with filter: addBreakpoints Request
2. without filter (brute force): sendCliCommand()


## 开发记录和知识库

[在线版本(观看效果更佳)](https://shimo.im/docs/hRQk6dXkxHp9pR3T)

[（待更新）离线版本](./docs/%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95%E5%92%8C%E7%9F%A5%E8%AF%86%E5%BA%93.pdf)