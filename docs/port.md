## 必须的依赖
1. ebpf支持
1. 符号表
1. risc-v工具链提供的gdb

## 配置
1. launch.json
1. `code-debug/src/frontend/extension.ts` 硬编码的用户程序名，硬编码的rCore位置
    1. 15行initproc改成ch9b_initproc
    2. 16行改成您要debug的rCore的位置，比如os.homedir() + "/rCore-Tutorial-Code-2023S"
1. `code-debug/src/mibase.ts` 硬编码的行号
    1. 1255行，65改成79
    2. 1264行和343行，135改成148
    3. 1281行，30改成43
1. 改内核编译参数
1. code-debug/src/frontend/extension.ts中的16行改成您要debug的rCore的位置，比如os.homedir() + "/rCore-Tutorial-Code-2023S"

 
