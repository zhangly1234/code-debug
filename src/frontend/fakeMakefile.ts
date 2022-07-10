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

/*example:
qemu-system-riscv64 -M 128m -machine virt -bios /home/oslab/rCore-Tutorial-v3/bootloader/rustsbi-qemu.bin -display none -device loader,file=/home/oslab/rCore-Tutorial-v3/os/target/riscv64gc-unknown-none-elf/release/os.bin,addr=0x80200000 -drive file=/home/oslab/rCore-Tutorial-v3/user/target/riscv64gc-unknown-none-elf/release/fs.img,if=none,format=raw,id=x0 -device virtio-blk-device,drive=x0 -device virtio-gpu-device  -device virtio-keyboard-device  -device virtio-mouse-device -serial stdio -s -S 
*/