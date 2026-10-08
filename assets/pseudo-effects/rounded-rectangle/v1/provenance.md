# Nya 圆角矩形 v1 伪效果资产

制作源：`schema.json`；布局审查：`authoring.xml`；生成命令：`node scripts/build-rounded-rectangle-pseudo.mjs`。

容器与参数流以 Tomas Šinkūnas 的 MIT 授权 `rendertom/PseudoEffect` README 中的 `Scribe` 样例为基础；原始二进制及许可证分别为 `base-scribe.ffx` 与 `LICENSE-rendertom.txt`。没有引用玄如意的二进制、表达式或制作源。

此版标签以 GBK 写入旧式 FFX 字符串，在本机简体中文 Windows AE 2025 的实验版本中读取成功。正式身份、折叠 UI、表达式绑定及其他系统/AE 版本仍待真实 AE 复验。未经这些复验不可称为跨平台发布版。

四角值为 0–100 百分比；分离时的像素半径 = `min(width,height)/2 × percent/100`。参考实测见 `docs/references/xuanruyi-rounded-rectangle-controls.md`；本工具继续保持 500×500 的实际路径尺寸，非分离时保持 50px 总圆角。
