# 住得明白

面向港科大内地学生的租房资料比较工具，使用原生 HTML、CSS 和 JavaScript，可作为静态网站发布。

## 本地预览

在本目录运行：

```powershell
py -m http.server 8500 --bind 127.0.0.1
```

然后打开 <http://127.0.0.1:8500/>。

## 数据范围

示例房源为演示数据。上传的截图只在当前页面预览；整理后的房源字段和收藏保存在当前浏览器的本地存储中，不会同步给其他用户或浏览器，也不会自动跨届留档。

## 发布

推送到 `main` 分支后，`.github/workflows/pages.yml` 会通过 GitHub Pages 发布站点。首次使用时需在仓库设置中将 Pages 来源设为 GitHub Actions。
