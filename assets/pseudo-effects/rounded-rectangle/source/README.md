# 伪效果生成基底

`base-scribe.ffx` 是 Tomas Šinkūnas 的 `rendertom/PseudoEffect` 项目中 MIT 授权的 Scribe 样例，授权文本见 `LICENSE-rendertom.txt`。它作为 `scripts/build-shape-pseudo-effects.mjs` 的制作输入，用于生成各形状的独立内置伪效果；样例本身不随 CEP 扩展打包。

当前用于新建圆角矩形的参数规格已回退到已通过 AE 验收的 `../v7/schema.json`；生成的唯一交付文件为 `public/host/pseudo-effects/rounded-rectangle-zh-CN.ffx`。其 SHA-256 必须为 `D51226CC1DD15988215CFBD27254C1F7377F2C1334E939B01CF0FA8B199BDEB9`。失败的 v8 资产不得进入交付目录。
