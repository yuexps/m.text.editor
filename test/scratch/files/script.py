# -*- coding: utf-8 -*-
# Python 语法高亮与语法检测测试

import os
import sys

def main():
    print("Python 真实测试文件")
    cwd = os.getcwd()
    print(f"当前工作目录为: {cwd}")
    print(f"Python 版本为: {sys.version}")

if __name__ == '__main__':
    main()
