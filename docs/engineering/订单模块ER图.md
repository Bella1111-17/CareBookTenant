erDiagram

%% =========================
%% 一、账号与护工
%% =========================

sys_user {
int user_id PK "用户ID"
int dept_id "部门ID"
varchar user_name "账号"
varchar nick_name "昵称"
varchar user_type "用户类型 00系统用户"
varchar email "邮箱"
varchar phonenumber "手机号"
char sex "性别 0男 1女 2未知"
varchar avatar "头像地址"
varchar password "登录密码"
varchar login_ip "最后登录IP"
timestamp login_date "最后登录时间"
varchar openid "微信openid"
varchar unionid "微信unionid"
varchar user_source "账号来源"
char del_flag "删除标记 0正常 1删除"
char status "状态 0正常 1停用"
varchar create_by "创建者"
timestamp create_time "创建时间"
varchar update_by "更新者"
timestamp update_time "更新时间"
varchar remark "备注"
}

caregiver_profile {
int id PK "护工档案ID"
int user_id FK "关联用户ID (UNIQUE)"
int years_of_experience "从业年限"
jsonb specialties "擅长领域 []"
jsonb strengths "特长标签 []"
jsonb personality_tags "性格标签 []"
text introduction "护工简介"
text id_card_images "身份证图片"
text caregiver_certificate_images "护工证图片"
text health_certificate_images "健康证图片"
char del_flag "删除标记 0正常 1删除"
char status "状态 0正常 1停用"
varchar create_by "创建者"
timestamp create_time "创建时间"
varchar update_by "更新者"
timestamp update_time "更新时间"
varchar remark "备注"
}

sys_user ||--|| caregiver_profile : "1对1 身份扩展"

%% =========================
%% 二、被护理人档案
%% =========================

care_recipient {
int id PK "被护理人ID"
int owner_user_id FK "所属C端用户ID (可空)"
varchar name "姓名"
char gender "性别"
date birthday "生日"
varchar id_card_no "身份证号"
varchar phone "联系电话"
varchar address "服务地址"
varchar guardian_name "主家属姓名"
varchar guardian_phone "主家属手机号"
text description "档案备注"
varchar illness "病情"
int height_cm "身高"
int weight_kg "体重"
char del_flag "删除标记"
char status "状态"
varchar create_by "创建者"
timestamp create_time "创建时间"
varchar update_by "更新者"
timestamp update_time "更新时间"
varchar remark "备注"
}

sys_user ||--o{ care_recipient : "C端归属认领"

%% =========================
%% 三、服务地址
%% =========================

care_address {
int id PK "地址ID"
int owner_user_id FK "所属用户ID"
varchar contact_name "联系人姓名"
varchar contact_phone "联系人电话"
varchar province_code "省编码"
varchar province_name "省名称"
varchar city_code "市编码"
varchar city_name "市名称"
varchar district_code "区编码"
varchar district_name "区名称"
varchar detail_address "详细地址"
char is_default "是否默认"
char del_flag "删除标记"
char status "状态"
varchar create_by "创建者"
timestamp create_time "创建时间"
varchar update_by "更新者"
timestamp update_time "更新时间"
varchar remark "备注"
}

sys_user ||--o{ care_address : "用户地址簿"

%% =========================
%% 四、服务商品
%% =========================

care_service_category {
int id PK "分类ID"
varchar name "分类名称"
varchar cover "分类封面图"
int sort_order "排序"
char del_flag "删除标记"
char status "状态"
varchar create_by "创建者"
timestamp create_time "创建时间"
varchar update_by "更新者"
timestamp update_time "更新时间"
varchar remark "备注"
}

care_service_item {
int id PK "服务商品ID"
int category_id FK "所属分类ID"
varchar name "服务名称"
int base_price_amount "基准价格(分，统一用分)"
varchar channel_scope "渠道范围"
char status "状态"
varchar duration_type "时长类型"
int duration_value "时长数值"
int sort "排序号"
text banners "轮播图"
text detail "详情图"
int sales_count "真实销量"
int sales_preset "虚拟销量"
char is_recommended "是否推荐"
char del_flag "删除标记"
varchar create_by "创建者"
timestamp create_time "创建时间"
varchar update_by "更新者"
timestamp update_time "更新时间"
varchar remark "备注"
}

care_service_category ||--o{ care_service_item : "包含商品"

%% =========================
%% 五、线上订单
%% =========================

care_online_order {
int id PK "线上订单ID"
varchar order_no "系统订单号(当前为纯数字单号)"
int user_id FK "下单用户ID"
int recipient_id FK "被护理人ID"
int service_item_id FK "服务商品ID"
int source_address_id FK "来源地址簿ID"
jsonb recipient_snapshot "被护理人快照"
jsonb service_item_snapshot "服务快照"
int quantity "购买数量"
int unit_price_amount "单价(分)"
int total_amount "总金额(分)"
int payable_amount "应付金额(分)"
int paid_amount "实付金额(分)"
varchar payment_status "支付状态"
varchar payment_channel "支付渠道"
int current_payment_order_id "关联支付单ID"
varchar merchant_order_no "商户支付单号"
varchar prepay_id "预支付单号"
varchar transaction_id "支付交易号"
varchar refund_status "退款状态"
varchar order_status "订单状态"
varchar contact_name "服务联系人"
varchar contact_phone "服务联系电话"
varchar province_code "省编码"
varchar province_name "省"
varchar city_code "市编码"
varchar city_name "市"
varchar district_code "区编码"
varchar district_name "区"
varchar detail_address "详细地址"
varchar full_address_snapshot "地址快照"
timestamptz planned_start_at "用户预约开始时间"
timestamptz planned_end_at "用户预约结束时间"
int actual_service_days "实际天数"
int actual_service_hours "实际小时"
varchar cancel_reason "取消原因"
timestamptz cancelled_at "取消时间"
timestamptz refund_requested_at "申请退款时间"
char del_flag "删除标记"
char status "状态"
varchar create_by "创建者"
timestamp create_time "创建时间"
varchar update_by "更新者"
timestamp update_time "更新时间"
varchar remark "备注"
}

%% =========================
%% 六、线下订单
%% =========================

care_offline_source_org {
int id PK "来源机构ID"
varchar name "机构名称"
char del_flag "删除标记"
char status "状态"
varchar create_by "创建者"
timestamp create_time "创建时间"
varchar update_by "更新者"
timestamp update_time "更新时间"
varchar remark "备注"
}

care_offline_order {
int id PK "线下订单ID"
varchar order_no "系统线下订单号"
varchar external_order_no "外部工单号"
int source_org_id FK "来源机构ID"
varchar source_org_name "来源机构名称"
int recipient_id FK "被护理人ID"
varchar patient_name "患者姓名"
char patient_gender "患者性别"
int patient_age "患者年龄"
varchar contact_type "联系人类型"
varchar contact_name "联系人姓名"
varchar contact_phone "联系人电话"
int service_item_id FK "服务商品ID"
jsonb service_item_snapshot "服务快照"
varchar condition_desc "病情描述"
varchar self_care_status "自理状况"
int expected_service_days "预计服务天数"
int actual_service_days "实际服务天数"
timestamptz planned_arrival_at "用户预约到岗时间"
varchar institution_name "医院/机构名称"
varchar institution_address "医院/机构地址"
varchar department_name "科室"
varchar bed_no "床位号"
int caregiver_user_id "护工用户ID"
varchar device_no "设备号"
int dispatch_user_id "派单人员ID"
timestamptz dispatched_at "派单时间"
varchar order_status "订单状态"
varchar settlement_status "结算状态"
varchar remark "备注"
char del_flag "删除标记"
char status "状态"
varchar create_by "创建者"
timestamp create_time "创建时间"
varchar update_by "更新者"
timestamp update_time "更新时间"
}

%% =========================
%% 七、履约主轴
%% =========================

care_relation {
int id PK "履约记录ID"
varchar relation_no "履约编号"
varchar source_type "来源类型"
int source_order_id "来源订单ID"
int owner_user_id "所属C端用户ID"
int care_recipient_id "被护理人ID"
int caregiver_user_id "护工用户ID"
int service_item_id "服务商品ID"
timestamptz planned_start_at "派单安排开始时间/预计到岗时间"
timestamptz planned_end_at "派单安排结束时间"
timestamptz actual_start_at "实际上单时间"
timestamptz actual_end_at "实际下单时间"
int actual_service_days "实际服务天数"
varchar service_status "服务状态"
varchar device_no "实际打卡设备号/外派设备号"
char del_flag "删除标记"
char status "状态"
varchar create_by "创建者"
timestamp create_time "创建时间"
varchar update_by "更新者"
timestamp update_time "更新时间"
varchar remark "备注"
}

%% =========================
%% 八、护理日报
%% =========================

care_daily_report {
int id PK "护理日报ID"
int care_relation_id FK "履约记录ID"
int care_offline_order_id FK "线下订单ID"
int owner_user_id "所属用户ID"
int care_recipient_id "被护理人ID"
int caregiver_user_id "主护工用户ID"
date report_date "日报日期"
int source_badge_report_id "来源智能工牌日报ID"
text summary_text "日报摘要"
jsonb report_card "结构化卡片内容"
varchar notify_status "通知状态"
timestamp notified_at "通知发送时间"
char del_flag "删除标记"
char status "状态"
varchar create_by "创建者"
timestamp create_time "创建时间"
varchar update_by "更新者"
timestamp update_time "更新时间"
varchar remark "备注"
}

%% =========================
%% 九、支付单
%% =========================

payment_order {
int id PK "支付单ID"
varchar business_type "业务类型"
int business_order_id "业务订单ID"
varchar business_order_no "业务订单号"
varchar pay_channel "支付渠道"
varchar pay_scene "支付场景"
varchar merchant_order_no "商户支付单号"
varchar openid "支付用户openid"
int amount "支付金额(分)"
varchar currency "币种"
varchar pay_status "支付状态"
varchar notify_status "回调处理状态"
varchar wechat_prepay_id "微信预支付ID"
varchar wechat_transaction_id "微信交易号"
timestamp success_time "支付成功时间"
timestamp notify_time "回调通知时间"
text raw_notify_body "原始回调报文"
text raw_notify_headers "原始回调请求头"
varchar fail_reason "失败原因"
char del_flag "删除标记"
char status "状态"
varchar create_by "创建者"
timestamp create_time "创建时间"
varchar update_by "更新者"
timestamp update_time "更新时间"
varchar remark "备注"
}

%% =========================
%% 十、退款申请单
%% =========================

payment_refund_order {
int id PK "退款申请单ID"
int payment_order_id FK "关联支付单ID"
varchar business_type "业务类型"
int business_order_id "业务订单ID"
varchar business_order_no "业务订单号"
varchar refund_no "系统退款单号"
varchar wechat_refund_id "微信退款单号"
varchar refund_type "退款类型"
varchar refund_reason_type "退款原因分类"
varchar responsibility_party "责任归属"
int paid_amount "原支付金额(分)"
int refund_amount "建议退款金额(分)"
int service_fee_amount "平台服务费(分)"
varchar suggested_action "规则建议动作"
varchar refund_status "退款单状态"
varchar rule_code "命中的规则编码"
jsonb rule_snapshot "规则命中快照"
int reviewer_user_id "审核人用户ID"
timestamptz reviewed_at "审核时间"
timestamptz executed_at "退款执行完成时间(不等同于用户到账时间)"
varchar failure_reason "失败原因"
text raw_notify_body "原始退款回调报文"
char del_flag "删除标记"
char status "状态"
varchar create_by "创建者"
timestamp create_time "创建时间"
varchar update_by "更新者"
timestamp update_time "更新时间"
varchar remark "备注"
}

%% =========================
%% 十一、护工AI日报（智能工牌日报）
%% =========================

nurse_daily_report {
int id PK "护工AI日报ID"
int user_id "护理员用户ID"
varchar device_no "设备序列号SN"
date report_date "日报日期"
int total_chunks "当日成功转写切片总数"
int total_duration_seconds "录音总时长"
int total_speech_seconds "真实讲话时长"
text asr_payload "投喂Dify的整理后文本"
text raw_asr_json_aggregate "原始ASR JSON聚合"
text full_transcript "Dify清洗后的对话流水"
jsonb service_score "Dify服务质量评分"
jsonb report_card "报表卡片结构化数据"
text emotion_summary "情绪概述"
text summary_text "Dify生成的日报摘要"
char del_flag "删除标记"
char status "状态"
varchar create_by "创建者"
timestamp create_time "创建时间"
varchar update_by "更新者"
timestamp update_time "更新时间"
varchar remark "备注"
}

%% =========================
%% 修正后的关系连线
%% =========================

sys_user ||--o{ care_online_order : "下单用户"
care_recipient ||--o{ care_online_order : "被护理人"
care_service_item ||--o{ care_online_order : "服务商品"
care_address ||--o{ care_online_order : "订单地址来源"

care_online_order ||--o{ payment_order : "支付记录(1对多支付尝试)"
care_online_order ||--o{ care_relation : "派生履约记录"
care_online_order ||--o{ payment_refund_order : "可能存在的多次退款"
payment_order ||--o{ payment_refund_order : "退款关联的原支付单"

care_offline_source_org ||--o{ care_offline_order : "来源机构"
care_recipient ||--o{ care_offline_order : "被护理人"
care_service_item ||--o{ care_offline_order : "服务商品"
care_offline_order ||--o{ care_relation : "派生履约记录"
care_offline_order ||--o{ care_daily_report : "线下单直挂日报"

sys_user ||--o{ care_relation : "护工用户"
care_recipient ||--o{ care_relation : "被护理人"
care_service_item ||--o{ care_relation : "服务商品"
care_relation ||--o{ care_daily_report : "履约段日报来源"

%% 工牌日报会被聚合/路由后写入正式业务日报
nurse_daily_report ||--o{ care_daily_report : "可作为正式日报的数据来源"
