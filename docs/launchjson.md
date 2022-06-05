```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "gdb",
            "request": "attach",
            "name": "Attach to Qemu",
            "executable": "/home/czy/rCore-Tutorial-v3/os/target/riscv64gc-unknown-none-elf/release/os",
            "target": ":1234",
            "remote": true,
            "cwd": "${workspaceRoot}",
            "valuesFormatting": "parseText",
            "gdbpath": "/home/czy/riscv64-unknown-elf-toolchain-10.2.0-2020.12.8-x86_64-linux-ubuntu14/bin/riscv64-unknown-elf-gdb",
            "showDevDebugOutput":true,
            "internalConsoleOptions": "openOnSessionStart",
            "printCalls": true,
            "stopAtConnect": true
        },
    ]
}
```