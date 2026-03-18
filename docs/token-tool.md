工具名称: token-assistor
工具ID: token-assistor
简述: 一个快速用固定的用户和密码得到token的工具

功能:
- 获取dev-token按钮,点击后调用api并将token写入剪切板，提示获取成功，已写入剪切板
- 获取prod-token按钮,点击后调用api并将token写入剪切板，提示获取成功，已写入剪切板


数据: 保存当前计数值到 storage

界面:
你帮我设计即可，很简单


配置: 
- dev token 获取方式：
curl 'https://dev-api.litnotes.ai/api/auth/login/email' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'Referer: https://dev-api.litnotes.ai/api' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36' \
  -H 'accept: application/json' \
  -H 'sec-ch-ua: "Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"' \
  -H 'Content-Type: application/json' \
  -H 'sec-ch-ua-mobile: ?0' \
  --data-raw $'{\n  "email": "xiongtoto0526@126.com",\n  "password": "Xht876222@"\n}'
  返回值：{
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Inhpb25ndG90bzA1MjZAMTI2LmNvbSIsInR5cGUiOiJub3JtYWwiLCJ1c2VySWQiOiI2ODE2MmNjZGI3NzIwNzM4MjI0YzBiNjUiLCJpYXQiOjE3NzM4MDk4NjgsImV4cCI6MTc3NTAxOTQ2OH0.3EwQQw3E24axfY6ltFf1OOMInLqrV_HP96SzXve_hWU"
    }
}
- prod token 获取方式，同上，域名改为 https://api.litnotes.ai 