# 调试器界面需求文档

## 功能

### 连接
```
|---------|
| Connect | 
|_________|
```

这个按钮用于连接到rCore-Tutorial里的gdbserver。按下之后从插件获取串口的地址，然后在调试控制台中发送一个命令`-side-stub connect 地址`。

### 符号查询

```
应用程序列表  选中的应用程序的符号表
--------------------------------
|Kernel    |0x8020     rust_main|
|App1      |0x0001     _start   |          
|App2      |0x0010     main     |
|App3      |0xffff     getpid   |
|....      |...        ...      |
---------------------------------
```

（VSCode WebView不能直接访问本地文件，因此获取应用程序列表以及获取符号表的功能不在网页中实现，网页里显示数据即可）


### 注册uprobes/kprobes
```
              ______________
Program Name：|_____________| 
         _______________
Address: |_____________|

____________
| Register | 
------------
```
这个界面的功能显而易见

## 用到的API
1. [插件和WebView之间的交互](https://code.visualstudio.com/api/extension-guides/webview)
1. [输出内容到调试控制台](https://code.visualstudio.com/api/references/vscode-api#DebugConsole)(实际上还得考虑输入内容到控制台，不过暂时没找到API)