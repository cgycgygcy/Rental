# 素材说明

看板中的五张房源插图均为演示素材。房源照片和租约资料需另行核实。

- 首页使用 `brand-mark.png` 品牌标识和 `guide-house.png` 房屋剖面插画。
- 五张看板插图由 codex-image2 调用 `gpt-image-2.5` 生成。请求尺寸为 1024 × 1024，质量为 `auto`，服务返回的原图为 1254 × 1254。网页使用 512 × 512 WebP。

## 生图提示词

每张图共用以下风格提示词，再接对应的场景描述。

> Square illustration for the ‘住得明白’ Hong Kong student rental comparison website. Contemporary architectural editorial illustration, fine dark forest-green ink contours, soft sage and grey-green washes, paper-white background, believable Hong Kong scale, discreet shading. Readable silhouette and few large shapes at 56px; central composition that can crop to a tall narrow thumbnail. Fill the middle of the frame with the subject. Calm ordinary living conditions, no people, no words, no logos, no location signs, no watermark, no photographic real-estate listing.

- `demo-village-house.webp` — Tai Po Tsai village house shared by students, compact three-storey New Territories village house on a green slope, shallow balconies, rooftop railing, steps and a low boundary wall. One main building in a slightly elevated three-quarter view.
- `demo-estate-room.webp` — A single private bedroom in a Hang Hau residential estate shared flat. One single bed, slim desk, apartment window with several slim Hong Kong residential towers outside. Three-quarter interior cutaway, central focus on the one room.
- `demo-tong-lau.webp` — A modest older Hong Kong walk-up tong lau used for a four-person flatshare in the Po Lam demo. Four to five storeys, narrow facade, regular metal window grilles, small projecting balconies and a modest external air conditioner. Street-corner three-quarter view with only a hint of neighboring walls.
- `demo-twin-room.webp` — Illustrative two-person student accommodation room in Diamond Hill. Show exactly two clearly separate single beds, two small desks and one shared window. Compact practical room in an architectural cutaway, with the two beds centered and readable even when cropped.
- `demo-shared-flat.webp` — An entire small Hong Kong apartment shared by two renters, location unspecified. Roofless architectural cutaway with two separate bedrooms each containing one bed, a small shared living room and a modest kitchen. Keep both bedrooms visible and center the plan.
