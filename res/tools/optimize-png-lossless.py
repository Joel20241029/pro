"""主包图集无损重编码；只改变PNG压缩，禁止尺寸/颜色/透明度降级。

依赖固定在requirements-png.txt；构建器会逐字节比较解码RGBA后才接纳输出。
上游API：https://github.com/fonttools/py-zopfli
"""
import argparse
from pathlib import Path
import struct

import zopfli.png


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    source = args.source.read_bytes()
    # 1.0.19主包接近4MiB：大图15轮继续无损搜索，小图保留10轮。
    # 仅增加构建耗时，尺寸、颜色及透明度完全不变，构建器仍核对解码像素。
    result = zopfli.png.optimize(
        source,
        lossy_transparent=False,
        lossy_8bit=False,
        keepchunks=["sRGB", "gAMA", "cHRM", "iCCP"],
        num_iterations=10,
        num_iterations_large=15,
    )
    if struct.unpack(">II", source[16:24]) != struct.unpack(">II", result[16:24]):
        raise ValueError("无损压缩改变了图集尺寸")
    args.output.write_bytes(result)


if __name__ == "__main__":
    main()
