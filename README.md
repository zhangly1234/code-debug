# 赛题
支持Rust语言的源代码级操作系统调试工具：[proj158-rust-debugger](https://github.com/oscomp/proj158-rust-debugger)

## 主要工作
- 支持 Rust 操作系统的基于 GDB 的内核态，用户态代码联合断点调试
- 解决 Rust 操作系统中基于 eBPF 的内核态，用户态代码的动态跟踪调试
- 远程开发环境下的用户界面（集成开发环境）支持与qemu，实际硬件（部分完成）的支持

## 文档和演示

- 展示文档
	- 2023.08.15 [决赛项目文档](./最终报告.pdf)
	- 2023.08.16 [决赛演示视频]

- 开发过程中积累的文档

- 开发日志

| 文档链接                                                     | 文档内容 |
| ------------------------------------------------------------ | -------- |
| [2023-01-02-rcore-Tutorial-ebpf 复现文档.md](./docs/2023-01-02-rcore-Tutorial-ebpf 复现文档.md) |          |
| [2023-07-07-修正文档.pdf](./docs/2023-07-07-修正文档.pdf)    |          |
| [2023-07-09.md](./docs/2023-07-09.md)                        |          |
| [2023-07-12.md](./docs/2023-07-12.md)                        |          |
| [2023-07-15.md](./docs/2023-07-15.md)                        |          |
| [2023-07-16.md](./docs/2023-07-16.md)                        |          |
| [2023-07-19.md](./docs/2023-07-19.md)                        |          |
| [2023-07-23.md](./docs/2023-07-23.md)                        |          |
| [2023-07-24.md](./docs/2023-07-24.md)                        |          |
| [2023-07-26.md](./docs/2023-07-26.md)                        |          |
| [2023-07-27.md](./docs/2023-07-27.md)                        |          |
| [2023-07-28.md](./docs/2023-07-28.md)                        |          |
| [2023-07-29.md](./docs/2023-07-29.md)                        |          |
| [2023-07-30.md](./docs/2023-07-30.md)                        |          |
| [2023-07-31.md](./docs/2023-07-31.md)                        |          |
| [2023-08-01.md](./docs/2023-08-01.md)                        |          |
| [2023-08-02.md](./docs/2023-08-02.md)                        |          |
| [2023-08-04.md](./docs/2023-08-04.md)                        |          |
| [2023-08-06.md](./docs/2023-08-06.md)                        |          |
| [2023-08-10.md](./docs/2023-08-10.md)                        |          |
| [2023-08-14.md](./docs/2023-08-14.md)                        |          |
| [2023-oscomp-share-13.pdf](./docs/2023-oscomp-share-13.pdf)  |          |
| [2023S.md](./docs/2023S.md)                                  |          |
| [Slides-August.md](./docs/Slides-August.md)                  |          |
| [Slides-August.pdf](./docs/Slides-August.pdf)                |          |
| [Slides-July.pdf](./docs/Slides-July.pdf)                    |          |
| [Slides-OSATC.md](./docs/Slides-OSATC.md)                    |          |
| [arch-eBPF-thoughts.md](./docs/arch-eBPF-thoughts.md)        |          |
| [diff-rCore-Tutorial-Code-2023S-kernel.diff](./docs/diff-rCore-Tutorial-Code-2023S-kernel.diff) |          |
| [diff-rCore-Tutorial-Code-2023S-user.diff](./docs/diff-rCore-Tutorial-Code-2023S-user.diff) |          |
| [ebpf vs ptrace.md](./docs/ebpf vs ptrace.md)                |          |
| [ebpf-ui.md](./docs/ebpf-ui.md)                              |          |
| [ebpf-update.md](./docs/ebpf-update.md)                      |          |
| [memory-read-write.md](./docs/memory-read-write.md)          |          |
| [mid.md](./docs/mid.md)                                      |          |
| [multiple_stubs.md](./docs/multiple_stubs.md)                |          |
| [new-code-debug-8-3.drawio](./docs/new-code-debug-8-3.drawio) |          |
| [oscomp-final.pptx](./docs/oscomp-final.pptx)                |          |
| [port-to-hardware.md](./docs/port-to-hardware.md)            |          |
| [port.md](./docs/port.md)                                    |          |
| [rCore-mod-old.diff](./docs/rCore-mod-old.diff)              |          |
| [rCore-mod-older.md](./docs/rCore-mod-older.md)              |          |
| [rCore-mod.diff](./docs/rCore-mod.diff)                      |          |
| [thesis-2023-july.md](./docs/thesis-2023-july.md)            |          |
| [thesis-outline.md](./docs/thesis-outline.md)                |          |
| [thesis.md](./docs/thesis.md)                                |          |
| [treeview.md](./docs/treeview.md)                            |          |
| [开发记录和知识库.pdf](./docs/开发记录和知识库.pdf)          |          |
| [陈志扬-OSATC-20230325-1807.pdf](./docs/陈志扬-OSATC-20230325-1807.pdf) |          |
| [2023-02-13](./docs/2023-02-13.md)                           |          |
| [2023-02-20](./docs/2023-02-20.md)                           |          |
| [2023-03-02](./docs/2023-03-02.md)                           |          |
| [2023-03-09](./docs/2023-03-09.md)                           |          |
| [2023-03-16](./docs/2023-03-16.md)                           |          |
| [2023-03-23](./docs/2023-03-23.md)                           |          |
| [2023-03-30](./docs/2023-03-30.md)                           |          |
| [2023-04-06](./docs/2023-04-06.md)                           |          |
| [2023-04-13](./docs/2023-04-13.md)                           |          |
| [2023-04-20](./docs/2023-04-20.md)                           |          |
| [2023-04-27](./docs/2023-04-27.md)                           |          |
| [2023-05-04](./docs/2023-05-04.md)                           |          |
| [2023-05-11](./docs/2023-05-11.md)                           |          |
| [2023-05-18](./docs/2023-05-18.md)                           |          |
| [2023-05-25](./docs/2023-05-25.md)                           |          |
| [2023-06-01](./docs/2023-06-01.md)                           |          |
| [2023-06-08](./docs/2023-06-08.md)                           |          |
| [2023-06-15](./docs/2023-06-15.md)                           |          |
| [2023-06-23](./docs/2023-06-23.md)                           |          |
| [2023-06-29](./docs/2023-06-29.md)                           |          |
| [2023-07-05](./docs/2023-07-05.md)                           |          |
| [2023-07-13](./docs/2023-07-13.md)                           |          |
| [2023-07-20](./docs/2023-07-20.md)                           |          |
| [2023-07-27](./docs/2023-07-27.md)                           |          |
|                                                              |          |
| [PCB](./docs/pcb_name.md)                                                             |          |
| [Github Readme](./docs/pcb_name.md)                                                             |          |

- 展示文档

- 开发文档

- 技术文档

## 项目进展和计划


## 项目仓库

| 仓库名 | 仓库描述 | Github 地址 | commit数量（2022年8月至今） |
| ------ | -------- | ---------- | ---------- |
| code-debug       | 本仓库         | <https://github.com/chenzhiy2001/code-debug>           | 124           |
| ruprobes       | 我们移植的uprobe模块和详细的移植文档         | <https://github.com/chenzhiy2001/ruprobes>           | 5           |
| rcore-ebpf(全小写)       | 整合了ebpf,kprobe,uprobe模块的rCore-Tutorial-v3         | <https://github.com/chenzhiy2001/rcore-ebpf>           | 8           |
| uCore-Tutorial-Test-2022A       | rcore-ebpf的C程序支持         | <https://github.com/chenzhiy2001/uCore-Tutorial-Test-2022A>           | 2           |
| trap_context_riscv       | trap_context crate （用于uprobe移植）          |<https://github.com/chenzhiy2001/trap_context_riscv>            | 5           |
| rCore-Tutorial-v3       | 支持“断点组切换”机制的修改版rCore-Tutorial-v3         | <https://github.com/chenzhiy2001/rCore-Tutorial-v3>           | 2           |
| qemu-system-riscv64       | 修改版的Qemu虚拟机         | <https://github.com/chenzhiy2001/qemu-system-riscv64>           | 1(关于我们对Qemu做的修改，可以看[文档3.3.2节](./最终报告.pdf))           |
| rustsbi-qemu       | 修改版的RustSBI         | <https://github.com/chenzhiy2001/rustsbi-qemu>           | 1(关于我们对RustSBI做的修改，可以看[文档3.3.2节](./最终报告.pdf))           |
| code-debug-doc       | 旧文档仓库，记录了6月之前的工作         | <https://github.com/chenzhiy2001/code-debug-doc>           | 13           |



# 致谢

感谢团队成员之间的相互鼓励和支持

感谢指导老师（吴竞邦老师，赵霞老师）不辞劳苦对本项目的引导

还要感谢向勇老师，彭淳毅同学，张露元学长，陈林峰学长，赵方亮学长，尤予阳学长在项目中提供的帮助和建议。