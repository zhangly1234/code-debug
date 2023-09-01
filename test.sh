#!/bin/bash
YELLOW='\033[0;33m'
RESET='\033[0m'
{
#安装git
sudo apt install git
# 检查是否安装了 curl
if command -v curl &> /dev/null; then
    echo -e "${YELLOW}curl is installed.${RESET}" | tee -a output1.txt
    # 更新 curl
    echo -e "${YELLOW}curl update...${RESET}" | tee -a output1.txt
    sudo apt-get update
    sudo apt-get install curl
    echo -e "${YELLOW}curl has installed.${RESET}" | tee -a output1.txt
else
    echo -e "${YELLOW}curl is not installed. Downloading...${RESET}" | tee -a output1.txt
    # 下载并安装 curl
    sudo apt-get update
    sudo apt-get install curl
    echo -e "${YELLOW}curl has installed.${RESET}" | tee -a output1.txt
fi
echo -e "${YELLOW}curl version: $(curl --version)${RESET}" | tee -a output1.txt








#安装rust环境
if command -v rustc &> /dev/null; then
    # 检查是否已经安装了rust nightly版本
    if rustup toolchain list | grep -q nightly; then
        echo -e "${YELLOW}Switching to nightly Rust toolchain${RESET}"| tee -a output1.txt
        rustup default nightly
    else
        echo -e "${YELLOW}Downloading and installing nightly Rust${RESET}"| tee -a output1.txt
        if curl https://sh.rustup.rs -sSf | sh; then
    	    source $HOME/.cargo/env
    	    if rustup install nightly; then
    	        rustup default nightly
                echo -e "${YELLOW}rust nightly has been installed.${RESET}" | tee -a output1.txt
    	    else
    	        echo -e  "${YELLOW}Error: Failed to install Rust Nightly.${RESET}"| tee -a output1.txt
    	        exit 1  
            fi  
        else
    	    echo -e "${YELLOW}Error: Failed to install Rust Nightly.${RESET}"| tee -a output1.txt
    	    exit 1
        fi
    fi
else 
    echo -e "${YELLOW}Downloading Rust${RESET}"| tee -a output1.txt
    if curl https://sh.rustup.rs -sSf | sh; then
    	source $HOME/.cargo/env
    	if rustup install nightly; then
    	    rustup default nightly
            echo -e "${YELLOW}rust nightly has been installed.${RESET}" | tee -a output1.txt
    	else
    	    echo -e  "${YELLOW}Error: Failed to install Rust Nightly.${RESET}"| tee -a output1.txt
    	    exit 1  
        fi  
    else
        echo -e "${YELLOW}Error: Failed to install Rust Nightly.${RESET}"| tee -a output1.txt
        exit 1
    fi
fi






#安装qemu
sudo apt install qemu-system-misc
echo -e "${YELLOW}安装qemu依赖的包......${RESET}" | tee -a output1.txt
sudo apt install autoconf automake autotools-dev curl libmpc-dev libmpfr-dev libgmp-dev \
              gawk build-essential bison flex texinfo gperf libtool patchutils bc \
              zlib1g-dev libexpat-dev pkg-config  libglib2.0-dev libpixman-1-dev libsdl2-dev \
              git tmux python3 python3-pip ninja-build coreutils xautomation xdotool
qemu_version=$(qemu-system-riscv64 --version 2>&1)
qemu_version=${qemu_version#*version }    
echo -e "${YELLOW}qemu version: $(qemu-system-riscv64 --version)${RESET}" | tee -a output1.txt
# 如果没有安装 QEMU 或版本号小于 7.0.0，则重新下载
if [[ -z "$qemu_version" || "$qemu_version" < "7.0.0" ]]; then
    echo -e "${YELLOW}QEMU is not installed or version is less than 7.0.0.${RESET}" | tee -a output1.txt
    echo -e "${YELLOW}如果qemu存在，需要先卸载.${RESET}" | tee -a output1.txt
    sudo apt remove qemu-system-misc
    echo -e "${YELLOW}重新下在qemu....${RESET}" | tee -a output1.txt
    if git clone https://github.com/chenzhiy2001/qemu-system-riscv64; then
        echo -e "${YELLOW}下载完成${RESET}"| tee -a output1.txt
    else
        echo -e "${YELLOW}Error: Failed to clone qemu-system-riscv64.${RESET}"| tee -a output1.txt
        exit 1
    fi
    # 编译安装并配置 RISC-V 支持
    cd qemu-system-riscv64
    echo -e "${YELLOW}编译qemu.....${RESET}"| tee -a output1.txt
    ./configure --target-list=riscv64-softmmu,riscv64-linux-user  # 如果要支持图形界面，可添加 " --enable-sdl" 参数
    make -j$(nproc)    
    cd ..
    echo -e "${YELLOW}QEMU has been installed.${RESET}" | tee -a output1.txt
    export PATH=$PATH:/home/zly/qemu-system-riscv64/build
else
    echo -e "${YELLOW}QEMU version $qemu_version is already installed.${RESET}" | tee -a output1.txt
    export PATH=$PATH:/home/zly/qemu-system-riscv64/build
fi

#此时我们可以确认 QEMU 的版本：
#qemu-system-riscv64 --version
#qemu-riscv64 --version






#安装node和npm
echo -e "${YELLOW}安装node和npm${RESET}" | tee -a output1.txt
# 获取 Node.js 版本信息
node_version=$(node -v)
echo -e "${YELLOW}Node.js version: $node_version${RESET}" | tee -a output1.txt

# 切割版本号字符串，获取主版本号
major_version=$(echo "$node_version" | cut -d. -f1 | sed 's/v//')

# 判断主版本号是否大于等于 18
if dpkg --compare-versions "$major_version" ge 18; then
  echo -e "${YELLOW}Node.js version is 18 or higher.${RESET}" | tee -a output1.txt
else
  echo -e "${YELLOW}Node.js version is below 18.install....${RESET}" | tee -a output1.txt
  sudo apt-get install -y ca-certificates curl gnupg
  sudo mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  NODE_MAJOR=18
  echo -e "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
  sudo apt-get update
  sudo apt-get install nodejs -y
  echo -e "${YELLOW}Node.js has installed.${RESET}" | tee -a output1.txt
fi




#安装有python支持的risc-v工具链
echo -e "${YELLOW}安装有python支持的risc-v工具链....${RESET}" | tee -a output1.txt
echo -e "${YELLOW}确保有 15GiB 剩余硬盘空间${RESET}" | tee -a output1.txt
echo -e "${YELLOW}下载python${RESET}" | tee -a output1.txt
sudo apt install python-is-python3
sudo apt-get install autoconf automake autotools-dev curl python3 libmpc-dev libmpfr-dev libgmp-dev gawk build-essential bison flex texinfo gperf libtool patchutils bc zlib1g-dev libexpat-dev ninja-build
sudo apt install python3-dev
pip3 install pyserial
echo -e "${YELLOW}需要克隆riscv-gnu-toolchain仓库${RESET}" | tee -a output1.txt
if git clone https://github.com/riscv/riscv-gnu-toolchain; then
    echo -e "${YELLOW}riscv-gnu-toolchain仓库下载完毕${RESET}" | tee -a output1.txt
    cd riscv-gnu-toolchain
    ./configure --prefix=/opt/riscv
    echo -e "${YELLOW}编译risc-v工具链,可能时间较长....${RESET}" | tee -a output1.txt
    if sudo make; then
        echo -e "${YELLOW}编译完成....${RESET}" | tee -a output1.txt
    else
        echo -e "${YELLOW}编译失败..${RESET}" | tee -a output1.txt
        exit 1 
    fi
else
    echo -e "${YELLOW}克隆git仓库失败${RESET}" | tee -a output1.txt
    exit 1 
fi
export PATH=$PATH:/opt/riscv/bin






#下载操作系统和调试器仓库
echo -e "${YELLOW}下载code-debug仓库...${RESET}" | tee -a output1.txt
if git clone https://github.com/chenzhiy2001/code-debug; then
    echo -e "${YELLOW}code-debug仓库下载完成${RESET}" | tee -a output1.txt
else
    echo -e "${YELLOW}克隆git仓库失败${RESET}" | tee -a output1.txt
    exit 1
fi

echo -e "${YELLOW}下载rcore仓库...${RESET}" | tee -a output1.txt
if git clone --recursive https://github.com/chenzhiy2001/rcore-ebpf; then
    echo -e "${YELLOW}rcore仓库下载完成${RESET}" | tee -a output1.txt
else
    echo -e "${YELLOW}克隆git仓库失败${RESET}" | tee -a output1.txt
    exit 1
fi



} | tee output.txt


