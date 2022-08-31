## 内存查看、编辑功能实现说明

目前，调试工具已经支持使用微软官方的HexEdit插件对内存指定地址数据进行显示和编辑，本文档主要介绍实现该功能的原理，以方便后续维护和升级。


## 之前内存访问的方式
在本项目的upstream仓库中，已经具备了在调试插件中查看内存数据的功能，但在该功能实现时，DAP中并没有关于内存读写的相关协议存在，因此使用了一个绕弯的方式来实现该功能，及DebugAdapter进程中启动了一个本地的socket服务器，在Extension进程中连接该服务器，相当于在DAP本身的RPC之外，又开辟了一条独立的RPC信道。通过这条新的信道，可以实现内存数据读取的功能，读取到的数据通过一个自定义的ContentProvider进行数据格式化，然后显示在窗口中。

该实现有如下问题：
* 使用了一个独立的Socket，增加了程序的复杂性，同时还需要用户选择不同会话之间对应的Socket连接，易用性很差。
* 仅支持内存查看，不支持实时修改


## 开源社区已有的前置工作

### Debug Apapter Protocol引入
DAP的1.35版本，引入了readMemory请求，在1.48版本引入了writeMemory请求。这两个请求使得通过标准DAP协议进行内存读取和修改成为了可能。


### VSCode支持DAP的readMemory、writeMemory请求
在 https://github.com/microsoft/vscode/pull/133643 这个PR中，VSCode 引入了对内存操作的支持，重点如下：

* 定义了新的schema`vscode-debug-memory`,并且将其关联到一个实现了虚拟文件系统接口的类`DebugMemoryFileSystemProvider`上。

  * 这也就意味着，如果打开一个URL以`vscode-debug-memory://`开头的文档，那么VSCode会调用`DebugMemoryFileSystemProvider`这个虚拟文件系统类来提供要显示的文件的内容。这个虚拟文件系统会解析文件URL中的其他参数（比如要访问的内存地址、读取数据的长度等等），创建出一个虚拟的文件描述符，并将文件的read请求自动翻译成DAP中的readMemory请求,将文件的write请求自动翻译为DAP协议中的writeMemory请求。

* 通过调用微软自己开发的另一款名为HexEdit的插件，来实现对内存的查看和编辑。
  * 具体来说，这个版本的VSCode引入了在调试模式界面下，在变量列表窗口中，每个变量的后面会出现一个查看内存数据的小图标，点击某个变量后面的这个小图标时，VSCode就会自动调用HexEdit插件来打开该变量内存所在地址的虚拟文件，这样就可以在HexEdit中查看编辑了。


### 微软的HexEdit插件
这是微软提供的一个十六进制查看、编辑的插件，可以以16进制和ASCII视图打开一个文件并进行编辑。

上面提到了，由于这个插件是微软官方开发的，和VSCode本身的代码联系还是很紧密的，因此这个插件里面包含针对memory debug的特殊支持, 引入这些特殊支持的提交是：https://github.com/microsoft/vscode-hexeditor/commit/5f742bd946356718de41aacd3d6ac00e15a0cb85



## 我的工作
1. 梳理清楚了上述各个前置工作之间的关联关系

1. 在`mibase.ts`中实现了`readMemoryRequest` 和 `writeMemoryRequest`两个方法的实现，将DAP的请求翻译成GDB的对应指令。

1. 删除了上游仓库中陈旧的实现方式，完全迁移到标准的DAP协议上，精简了代码

1. 修改`code-debug.examineMemoryLocation`命令的实现逻辑，由用户输入需要查看的内存地址范围以后，自动调用HexEdit插件来显示或编辑内存数据



## 后续展望

* 目前，HexEdit还是一个独立的插件，这个插件所提供的十六进制编辑视图本身并没有集成到VSCode中，但是社区也在讨论后续是否会将这个视图内置到VSCode中。这个点可以跟进关注
  * 在融合到VSCode之前，我们的插件如果想使用内存查看、编辑功能，就必须首先安装好HexEdit插件，可以引入自动检测功能，如果发现当前还没有安装HexEdit插件，那么提示用户安装。


* 由于我们目前的插件还不支持在调试窗口的TreeView中显示本地变量等，因此也就没有办法使用VSCode本身已经集成的查看变量内存的功能。期望在后续把WebView完全替换成TreeView以后，就可以多一种查看内存的操作入口。

* 目前，虚拟文件系统和HexEdit之间对异常的传递不是很友好，如果GDB在读取内存过程中发生错误，这个错误不能经由虚拟文件系统传递给HexEdit，这会导致当底层发生错误时，HexEdit窗口无法体现出错情况。