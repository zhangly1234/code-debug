let PROJECT_PATH = '/home/oslab/rCore-Tutorial-v3'; //make sure this is correct
let TARGET = 'riscv64gc-unknown-none-elf';
let MODE = 'release';
let SYMBOL_BIN = PROJECT_PATH+'/os/target/'+TARGET+'/' + MODE + '/os';
let KERNEL_BIN = SYMBOL_BIN+'.bin';
let FS_IMG = `${PROJECT_PATH}/user/target/${TARGET}/${MODE}/fs.img`

//TODO add QEMU_PATH
export let startupCmd=`qemu-system-riscv64 \
-M 128m \
-machine virt \
-bios ${PROJECT_PATH}/bootloader/rustsbi-qemu.bin \
-display none \
-device loader,file=${KERNEL_BIN},addr=0x80200000 \
-drive file=${FS_IMG},if=none,format=raw,id=x0 \
-device virtio-blk-device,drive=x0 \
-device virtio-gpu-device  \
-device virtio-keyboard-device  \
-device virtio-mouse-device \
-serial stdio \
-s -S `