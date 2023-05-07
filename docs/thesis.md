1. eBPF技术简介（怎么用eBPF技术获取信息（kprobe），存储信息，用eBPF的优势）
2. gdbserver协议, gdbserver和eBPF server的不同（eBPF-server以异步的消息为主。异步的消息和同步的消息重合了怎么办（%））
3. 用gdb的python扩展（重新编译）
4. qemu支持新串口（为什么要用第二个串口，pmp，基于中断的串口消息收发机制（正是因为这个机制，消息不能返回server，而是直接由eBPF程序返回），qemu virtio）
