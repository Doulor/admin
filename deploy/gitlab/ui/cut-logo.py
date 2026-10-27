# 把徽标外圈以外的近白底变透明；外圈线的抗锯齿边按亮度换成透明度，避免灰底上出白边
import sys
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert("RGBA")).astype(np.float64)
h, w = im.shape[:2]
cx, cy, r_ring = 127.5, 127.5, 123.5
ring = np.array([68.0, 70.0, 142.0])
yy, xx = np.mgrid[0:h, 0:w]
r = np.hypot(xx - cx, yy - cy)
lum = im[..., :3].mean(axis=2)
alpha = np.clip((250.0 - lum) / (250.0 - ring.mean()), 0.0, 1.0)
out = im.copy()
outside = r > r_ring
out[..., 3] = np.where(outside, alpha * 255.0, 255.0)
for c in range(3):
    out[..., c] = np.where(outside, ring[c], im[..., c])
out[..., 3] = np.where(r > r_ring + 4, 0.0, out[..., 3])
Image.fromarray(out.round().astype(np.uint8), "RGBA").save(dst, optimize=True)
