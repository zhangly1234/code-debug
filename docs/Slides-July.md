---
marp: true
theme: default
paginate: true
_paginate: false
header: ''
footer: ''
backgroundColor: white
---

# CoreDebugger
支持Rust语言的源代码级内核调试工具

---

## 起因
- gdb调试rCore
- TUI调试不便
	- 代码文件较多
	- 频繁切换符号文件
---
## 功能
- 可结合rust-analyzer等插件使用
- 获取当前特权级
- 寄存器和内存数据
- 系统调用跟踪
- 保留文本控制台
![bg contain right:60%](./imgs/coredebugger-screenshot-bootstrap-mid.png)
---

## 设计
- qemu gdbstub
- GDB/MI interface
	- 正则表达式匹配
- Debug Adapter
	- 独立进程，连接VSCode和gdb
	- Debug Adapter Protocol
![bg contain right:60%](./imgs/arch.png)
---

## 使用场景
- 跟踪系统调用
- 查看内核数据结构
- 获得寄存器信息
---

## 局限
- gdb的bug
	- Self变量
	- Vec, VecDeque
		- 可查看但输出信息有误
- lazy_static!宏
- 被内联展开的函数

---
## 谢谢！


