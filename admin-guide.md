# IVYJSTUDIO 后台管理操作手册

> **适用版本:** v1.1 (Post-MVP Enhanced)  
> **更新日期:** 2025-12-25

---

## 目录

1. [登录与导航](#1-登录与导航)
2. [仪表盘 (Dashboard)](#2-仪表盘-dashboard)
3. [商品管理 (Items)](#3-商品管理-items)
4. [AI 智能导入](#4-ai-智能导入)
5. [订单管理 (Reservations)](#5-订单管理-reservations)
6. [客户管理 (Customers)](#6-客户管理-customers)
7. [系统设置 (Settings)](#7-系统设置-settings)
8. [常见问题 (FAQ)](#8-常见问题-faq)

---

## 1. 登录与导航

### 访问后台
- **URL**: `/admin`
- **权限**: 仅限 `role = 'admin'` 的用户访问
- 非管理员访问将被重定向至首页

### 导航结构
| 菜单项 | 路径 | 功能 |
|--------|------|------|
| Dashboard | `/admin` | 业务概览统计 |
| Items | `/admin/items` | 商品库存管理 |
| Reservations | `/admin/reservations` | 租赁订单处理 |
| Customers | `/admin/customers` | 客户信息查看 |
| Settings | `/admin/settings` | 系统配置 |

---

## 2. 仪表盘 (Dashboard)

仪表盘提供四项关键业务指标：

| 指标卡片 | 含义 |
|----------|------|
| **Total Items** | 活跃库存商品数量 |
| **Active Rentals** | 当前外借中的商品数 |
| **Customers** | 注册客户总数 |
| **Utilization** | 库存使用率 |

> **Note:** 当前版本数据为占位符，后续迭代将接入实时统计。

---

## 3. 商品管理 (Items)

**路径:** `/admin/items`

### 3.1 视图模式切换

页面右上角提供三个按钮：

| 按钮 | 功能 |
|------|------|
| **Add Item** | 手动新增单个商品 |
| **AI Import** | 打开 AI 智能导入面板 |
| **Review Imports** | 查看待审核的 AI 导入批次 (有待处理时显示红点徽章) |

### 3.2 分组列表视图 (GroupedItemsList)

- 商品按 **设计名 (Design Name)** 自动分组
- 点击组头可 **折叠/展开** 该设计的所有变体
- 每个变体行显示：颜色、SKU、日租金、状态、操作按钮

### 3.3 新增/编辑商品

**路径:** `/admin/items/new` 或 `/admin/items/[id]`

| 字段 | 说明 |
|------|------|
| Name | 设计名称 (同名商品自动归为变体组) |
| SKU | 唯一标识码 |
| Color | 颜色/款式标识 |
| Category | 分类 (可在 Settings 管理) |
| Collection | 系列 (可在 Settings 管理) |
| Rental Price | 日租金 (USD) |
| Retail Price | 零售价 (仅展示用) |
| Weight (g) | 重量克数 |
| Description | 详细描述 |
| Status | `Active` / `Maintenance` / `Retired` |
| Images | 支持多图上传，首图为封面 |

**快捷操作:**
- **Save & Add Variation**: 保存后立即跳转至新建页，自动继承当前商品的 Name，方便快速录入多色变体。

### 3.4 商品生命周期

| 状态 | 含义 |
|------|------|
| **Active** | 可正常租赁 |
| **Maintenance** | 维护中，暂停接单 |
| **Retired** | 已下架，不再展示 |

---

## 4. AI 智能导入

**入口:** Items 页面 → "AI Import" 按钮

### 4.1 完整工作流

```
输入 URL → 提取分类 → 选择分类 → Quick Scan → 映射分类/系列 → 提交至 Staging → 人工审核 → Commit 入库
```

### 4.2 操作步骤

#### Step 1: 输入源 URL
在输入框粘贴目标网站 URL，点击 **"Extract Categories"**。

- AI 会实时流式输出思考过程 (终端风格控制台)
- 提取完成后显示网站分类列表

#### Step 2: 选择要扫描的分类
- 勾选需要导入的分类
- 可使用 **"Explore Depth"** 按钮进一步获取子分类

#### Step 3: Quick Scan
点击 **"Start Quick Scan"**：
- AI 逐个分类抓取产品列表
- 控制台实时显示每个分类的抓取进度与商品数量

#### Step 4: 分类映射
扫描完成后，为每个提取的分类选择对应的本地 Category 和 Collection。
- 也可使用 **"Auto Categorize"** 让 AI 自动匹配

#### Step 5: 提交至 Staging
确认映射后，数据将保存至 `staging_items` 表等待人工审核。

### 4.3 AI 配置 (高级)

在 AI Import 面板右上角点击 **齿轮图标** 打开配置弹窗：

| 配置项 | 说明 |
|--------|------|
| **Model** | 选择 Gemini 模型 (Flash 更快，Pro 更准) |
| **Thinking Level** | 分环节设置思考深度 (Low/Medium/High) |
| **Max Output Tokens** | 单次响应最大 Token 数 |
| **System Instruction** | 是否启用全局 AI 人设 |
| **Custom Prompts** | 各环节的自定义提示词 |
| **Test Chat** | 与模型对话测试配置效果 |
| **Speed Scan Test** | 使用测试 URL 验证扫描流程 |

### 4.4 Staging 审核

**入口:** Items 页面 → "Review Imports" 按钮

- 查看每个 Import Batch 的状态与商品预览
- 可编辑单个 Staging Item 的信息
- **Commit Batch**: 批量入库至正式 `items` 表
- **Rollback Batch**: 撤销整批导入

---

## 5. 订单管理 (Reservations)

**路径:** `/admin/reservations`

### 5.1 筛选器

页面顶部提供状态筛选 Tab：

| 筛选项 | 含义 |
|--------|------|
| **Pending** | 待审批 |
| **Approved** | 已发送 Invoice，等待付款 |
| **Confirmed** | 已付款确认 |
| **Shipped** | 已发货 |
| **Archived** | 已归档/历史订单 |

另可通过 URL 参数 `?customer=email@example.com` 按客户筛选。

### 5.2 分组聚合视图

- 同一 `group_id` 的订单合并为一行
- 显示客户信息、商品列表缩略图、总金额、状态徽章

### 5.3 操作按钮

| 按钮 | 功能 | 适用状态 |
|------|------|----------|
| **Review & Invoice** | 审批并发送 Invoice 邮件 | Pending |
| **Dispatch** | 录入 Tracking Number 并发送发货通知 | Approved/Confirmed |
| **Archive** | 归档订单 | 任意非归档状态 |
| **Restore** | 从归档恢复 | Archived |

### 5.4 审批与 Invoice (详细流程)

点击 **"Review & Invoice"** 按钮后：

1. **选择 Billing Profile**: 下拉选择账单主体 (公司抬头、银行信息)
2. **预览 Invoice**: 
   - 实时渲染 Invoice 样式
   - 含客户信息、商品明细、银行付款信息
3. **添加备注**: 可填写 Invoice 备注 (客户可见)
4. **确认发送**: 点击 "Confirm & Send Invoice"
   - 订单状态变更为 `approved`
   - 自动生成 PDF Invoice 并通过 Resend 发送邮件

---

## 6. 客户管理 (Customers)

**路径:** `/admin/customers`

显示所有非管理员用户列表：

| 列 | 说明 |
|----|------|
| **Name** | 客户姓名 |
| **Email** | 点击可跳转至该客户的订单列表 |
| **Company** | 公司名称 |
| **Domain** | 组织域名标识 |

> **Note:** 客户通过提交预约请求自动创建，无需手动录入。

---

## 7. 系统设置 (Settings)

**路径:** `/admin/settings`

设置页面包含四个 Tab：

---

### Tab 1: Billing Profiles (账单主体)

用于管理 Invoice 上的公司信息与收款账户。

| 操作 | 说明 |
|------|------|
| **Add Profile** | 新增账单主体 |
| **Edit** | 编辑现有 Profile |
| **Set as Default** | 设为默认 (审批订单时自动选中) |
| **Delete** | 删除 Profile (需先确保无关联订单) |

**Profile 字段:**
- Profile Name (内部标识)
- Company Header (多行公司抬头)
- Bank Info (银行账户信息)
- Contact Email (联系邮箱)

---

### Tab 2: Communications (通讯配置)

配置自动发送邮件的模板。

#### 邮件类型

| 类型 | 触发时机 |
|------|----------|
| **Approval Email** | 订单审批时发送 Invoice |
| **Shipping Email** | 录入 Tracking Number 后发送 |

#### 编辑界面
- **左侧**: 模板编辑器
- **右侧**: 实时预览 (邮件/PDF)

#### 模板变量

| 变量 | 含义 |
|------|------|
| `{{customerName}}` | 客户姓名 |
| `{{itemName}}` | 商品名称 |
| `{{startDate}}` | 租期开始日期 |
| `{{endDate}}` | 租期结束日期 |
| `{{reservationId}}` | 订单 ID |
| `{{trackingNumber}}` | 物流单号 |
| `{{trackingUrl}}` | 物流查询链接 |

#### 测试发送
- 输入测试邮箱地址
- 点击 "Send Test Email"
- 系统使用模拟数据发送测试邮件

---

### Tab 3: Taxonomy (分类与系列)

管理商品的 Category 和 Collection。

| 操作 | 说明 |
|------|------|
| **Add** | 新增分类/系列 |
| **Toggle Visibility** | 切换显示/隐藏状态 |
| **Delete** | 删除 (需先确保无商品关联) |

> **Warning:** 隐藏的分类/系列不会在前台展示，但后台仍可使用。

---

### Tab 4: System (核心参数)

| 参数 | 说明 |
|------|------|
| **Turnaround Buffer** | 订单周转缓冲天数 (同一商品两笔订单间的最小间隔)。例如设为 1，表示商品归还后至少隔 1 天才能再次出租。 |
| **Booking Password** | 前台租赁预约表单的访问密码。留空则开放访问。 |
| **Contact Email** | 系统邮件的 Reply-To 地址。客户回复邮件将发送至此邮箱。 |

---

## 8. 常见问题 (FAQ)

### Q: AI 导入时出现 "Failed to fetch URL" 错误？
**A:** 确保目标网站允许抓取，且 URL 格式正确。系统已强制启用 Google Search Grounding 以提升准确性。

### Q: 如何批量编辑商品？
**A:** 当前版本不支持批量编辑，请逐个修改或使用 AI 导入重新抓取。

### Q: 删除 Category 报错？
**A:** 该分类下仍有关联商品。请先将这些商品移至其他分类再删除。

### Q: Invoice 邮件未发送？
**A:** 检查以下项：
1. `RESEND_API_KEY` 环境变量是否正确配置
2. Billing Profile 是否已创建
3. 客户邮箱地址是否有效

### Q: 如何修改 Invoice PDF 样式？
**A:** 当前版本 PDF 样式固定，如需定制请联系开发人员修改 `lib/pdf/invoice.ts`。

---

## 附录：快捷键

| 操作 | 快捷键 |
|------|--------|
| 导航至 Dashboard | `Alt + 1` (待实现) |
| 导航至 Items | `Alt + 2` (待实现) |
| 刷新当前页 | `Cmd/Ctrl + R` |

---

> **文档维护:** 如有功能更新，请同步更新本手册与 `handover.doc`。
