/*
Navicat MySQL Data Transfer

Source Server         : daaa
Source Server Version : 50726
Source Host           : localhost:3306
Source Database       : fssoa-net

Target Server Type    : MYSQL
Target Server Version : 50726
File Encoding         : 65001

Date: 2026-07-01 00:41:01
*/

SET FOREIGN_KEY_CHECKS=0;

-- ----------------------------
-- Table structure for `casbin_rule`
-- ----------------------------
DROP TABLE IF EXISTS `casbin_rule`;
CREATE TABLE `casbin_rule` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `ptype` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '策略类型: p(权限) / g(角色继承) / g2(部门继承)',
  `v0` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '第1个参数: 用户ID/角色ID/部门ID',
  `v1` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '第2个参数: 资源/角色/部门',
  `v2` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '第3个参数: 操作/动作',
  `v3` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '第4个参数: 扩展字段',
  `v4` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '第5个参数: 扩展字段',
  `v5` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '第6个参数: 扩展字段',
  PRIMARY KEY (`id`),
  KEY `idx_ptype` (`ptype`),
  KEY `idx_v0` (`v0`),
  KEY `idx_v1` (`v1`),
  KEY `idx_v0_v1` (`v0`,`v1`)
) ENGINE=InnoDB AUTO_INCREMENT=2431 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Casbin权限规则表';

-- ----------------------------
-- Records of casbin_rule
-- ----------------------------
INSERT INTO `casbin_rule` VALUES ('886', 'p', '1', '/api/api/core/system/user', 'GET', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1196', 'p', 'ceo', '/api/core/console', 'GET', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1197', 'p', 'ceo', '/api/core/console/list', 'GET', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1198', 'p', 'ceo', '/api/core/console/*', 'GET', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1202', 'g', '105', 'ceo', '', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1204', 'g', '101', 'ceo', '', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1278', 'p', 'JTCEO', '/api/core/console', 'GET', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1279', 'p', 'JTCEO', '/api/core/console/list', 'GET', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1280', 'p', 'JTCEO', '/api/core/console/*', 'GET', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1281', 'p', 'JTCEO', '/api/tool/crontab', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1282', 'p', 'JTCEO', '/api/tool/crontab', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1283', 'p', 'JTCEO', '/api/tool/crontab', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1284', 'p', 'JTCEO', '/api/tool/code', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1285', 'p', 'JTCEO', '/api/tool/code', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1544', 'p', '2', '/api/core/user', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1545', 'p', '2', '/api/core/user', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1546', 'p', '2', '/api/core/user', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1547', 'p', '2', '/api/core/user', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1548', 'p', '2', '/api/core/user', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1549', 'p', '2', '/api/core/user', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1550', 'p', '2', '/api/core/user', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1551', 'p', '2', '/api/core/user', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1552', 'p', '2', '/api/core/dept', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1553', 'p', '2', '/api/core/dept', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1554', 'p', '2', '/api/core/dept', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1555', 'p', '2', '/api/core/dept', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1556', 'p', '2', '/api/core/dept', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1557', 'p', '2', '/api/core/role', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1558', 'p', '2', '/api/core/role', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1559', 'p', '2', '/api/core/role', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1560', 'p', '2', '/api/core/role', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1561', 'p', '2', '/api/core/role', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1562', 'p', '2', '/api/core/role', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1563', 'p', '2', '/api/core/post', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1564', 'p', '2', '/api/core/post', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1565', 'p', '2', '/api/core/post', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1566', 'p', '2', '/api/core/post', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1567', 'p', '2', '/api/core/post', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1568', 'p', '2', '/api/core/post', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1569', 'p', '2', '/api/core/post', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1570', 'p', '2', '/api/core/menu', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1571', 'p', '2', '/api/core/menu', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1572', 'p', '2', '/api/core/menu', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1573', 'p', '2', '/api/core/menu', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1574', 'p', '2', '/api/core/menu', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1575', 'p', '2', '/api/core/config', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1576', 'p', '2', '/api/core/config', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1577', 'p', '2', '/api/core/config', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1578', 'p', '2', '/api/core/dict', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1579', 'p', '2', '/api/core/dict', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1580', 'p', '2', '/api/core/attachment', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1581', 'p', '2', '/api/core/attachment', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1582', 'p', '2', '/api/core/database', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1583', 'p', '2', '/api/core/database', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1584', 'p', '2', '/api/core/recycle', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1585', 'p', '2', '/api/core/recycle', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1586', 'p', '2', '/api/core/logs', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1587', 'p', '2', '/api/core/logs', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1588', 'p', '2', '/api/core/logs', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1589', 'p', '2', '/api/core/logs', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1590', 'p', '2', '/api/core/email', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1591', 'p', '2', '/api/core/email', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1592', 'p', '2', '/api/core/server', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1593', 'p', '2', '/api/core/server', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1594', 'p', '2', '/api/core/server', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1595', 'p', '2', '/api/core/console', 'GET', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1596', 'p', '2', '/api/core/console/list', 'GET', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1597', 'p', '2', '/api/core/console/*', 'GET', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1598', 'p', '2', '/api/tool/crontab', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1599', 'p', '2', '/api/tool/crontab', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1600', 'p', '2', '/api/tool/crontab', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1601', 'p', '2', '/api/tool/code', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1602', 'p', '2', '/api/tool/code', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1603', 'p', '2', '/api/core/dept', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1604', 'p', '2', '/api/core/tenant', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1605', 'p', '2', '/api/core/tenant', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1606', 'p', '2', '/api/core/tenant', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1607', 'p', '2', '/api/core/tenant', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1608', 'p', '2', '/api/core/tenant', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1609', 'p', '2', '/api/core/server', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1610', 'p', '2', '/flow', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1611', 'p', '2', '/api/flow/category', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1612', 'p', '2', '/flow/category', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1613', 'p', '2', '/flow/category/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1614', 'p', '2', '/api/flow/template', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1615', 'p', '2', '/flow/template', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1616', 'p', '2', '/flow/template/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1617', 'p', '2', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1618', 'p', '2', '/flow/instance/my-started', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1619', 'p', '2', '/flow/instance/my-started/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1620', 'p', '2', '/api/flow/task', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1621', 'p', '2', '/flow/task/pending', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1622', 'p', '2', '/flow/task/pending/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1623', 'p', '2', '/api/flow/task', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1624', 'p', '2', '/flow/task/completed', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1625', 'p', '2', '/flow/task/completed/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1626', 'p', '2', '/api/flow/template', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1627', 'p', '2', '/flow/template/design/:id', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1628', 'p', '2', '/flow/template/design/:id/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1629', 'p', '2', '/api/flow/template', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1630', 'p', '2', '/flow/template/form-design/:id', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1631', 'p', '2', '/flow/template/form-design/:id/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1632', 'p', '2', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1633', 'p', '2', '/flow/instance/start/:templateId', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1634', 'p', '2', '/flow/instance/start/:templateId/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1635', 'p', '2', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1636', 'p', '2', '/flow/instance/detail/:id', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1637', 'p', '2', '/flow/instance/detail/:id/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1638', 'p', '2', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1639', 'p', '2', '/flow/form/leave-request', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1640', 'p', '2', '/flow/form/leave-request/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1641', 'p', '2', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1642', 'p', '2', '/flow/form/expense-claim', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1643', 'p', '2', '/flow/form/expense-claim/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1644', 'p', '2', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1645', 'p', '2', '/flow/form/purchase-request', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1646', 'p', '2', '/flow/form/purchase-request/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1647', 'p', '2', '/api/flow/category', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1648', 'p', '2', '/api/flow/category', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1649', 'p', '2', '/api/flow/category', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1650', 'p', '2', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1651', 'p', '2', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1652', 'p', '2', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1653', 'p', '2', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1654', 'p', '2', '/api/flow/task', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1655', 'p', '2', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1656', 'p', '2', '/api/flow/task', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1657', 'p', '2', '/flow/task/copy-me', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1658', 'p', '2', '/flow/task/copy-me/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1659', 'g', '2', 'ceo', '', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1791', 'g', '119', 'ceo', '', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1792', 'g', '120', 'bg_president', '', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1793', 'g', '121', 'gm', '', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1839', 'g', '123', 'ceo', '', '', '', '');
INSERT INTO `casbin_rule` VALUES ('1840', 'g', '122', 'bg_president', '', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2111', 'g', '10', 'staff', '', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2132', 'p', '100', '/api/core/user', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2133', 'p', '100', '/api/core/user', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2134', 'p', '100', '/api/core/user', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2135', 'p', '100', '/api/core/user', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2136', 'p', '100', '/api/core/user', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2137', 'p', '100', '/api/core/user', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2138', 'p', '100', '/api/core/user', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2139', 'p', '100', '/api/core/user', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2140', 'p', '100', '/api/core/dept', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2141', 'p', '100', '/api/core/dept', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2142', 'p', '100', '/api/core/dept', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2143', 'p', '100', '/api/core/dept', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2144', 'p', '100', '/api/core/dept', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2145', 'p', '100', '/api/core/role', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2146', 'p', '100', '/api/core/role', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2147', 'p', '100', '/api/core/role', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2148', 'p', '100', '/api/core/role', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2149', 'p', '100', '/api/core/role', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2150', 'p', '100', '/api/core/role', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2151', 'p', '100', '/api/core/post', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2152', 'p', '100', '/api/core/post', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2153', 'p', '100', '/api/core/post', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2154', 'p', '100', '/api/core/post', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2155', 'p', '100', '/api/core/post', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2156', 'p', '100', '/api/core/post', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2157', 'p', '100', '/api/core/post', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2158', 'p', '100', '/api/core/menu', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2159', 'p', '100', '/api/core/menu', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2160', 'p', '100', '/api/core/menu', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2161', 'p', '100', '/api/core/menu', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2162', 'p', '100', '/api/core/menu', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2163', 'p', '100', '/api/core/config', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2164', 'p', '100', '/api/core/config', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2165', 'p', '100', '/api/core/config', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2166', 'p', '100', '/api/core/console', 'GET', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2167', 'p', '100', '/api/core/console/list', 'GET', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2168', 'p', '100', '/api/core/console/*', 'GET', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2169', 'p', '100', '/api/core/dept', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2170', 'p', '100', '/api/core/tenant', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2171', 'p', '100', '/api/core/tenant', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2172', 'p', '100', '/api/core/tenant', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2173', 'p', '100', '/api/core/tenant', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2174', 'p', '100', '/api/core/tenant', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2175', 'p', '100', '/template', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2176', 'p', '100', '/flow', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2177', 'p', '100', '/api/flow/category', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2178', 'p', '100', '/flow/category', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2179', 'p', '100', '/flow/category/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2180', 'p', '100', '/api/flow/template', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2181', 'p', '100', '/flow/template', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2182', 'p', '100', '/flow/template/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2183', 'p', '100', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2184', 'p', '100', '/flow/instance/my-started', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2185', 'p', '100', '/flow/instance/my-started/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2186', 'p', '100', '/api/flow/task', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2187', 'p', '100', '/flow/task/pending', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2188', 'p', '100', '/flow/task/pending/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2189', 'p', '100', '/api/flow/task', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2190', 'p', '100', '/flow/task/completed', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2191', 'p', '100', '/flow/task/completed/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2192', 'p', '100', '/api/flow/template', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2193', 'p', '100', '/flow/template/design/:id', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2194', 'p', '100', '/flow/template/design/:id/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2195', 'p', '100', '/api/flow/template', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2196', 'p', '100', '/flow/template/form-design/:id', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2197', 'p', '100', '/flow/template/form-design/:id/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2198', 'p', '100', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2199', 'p', '100', '/flow/instance/start/:templateId', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2200', 'p', '100', '/flow/instance/start/:templateId/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2201', 'p', '100', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2202', 'p', '100', '/flow/instance/detail/:id', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2203', 'p', '100', '/flow/instance/detail/:id/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2204', 'p', '100', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2205', 'p', '100', '/flow/form/leave-request', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2206', 'p', '100', '/flow/form/leave-request/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2207', 'p', '100', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2208', 'p', '100', '/flow/form/expense-claim', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2209', 'p', '100', '/flow/form/expense-claim/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2210', 'p', '100', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2211', 'p', '100', '/flow/form/purchase-request', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2212', 'p', '100', '/flow/form/purchase-request/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2213', 'p', '100', '/api/flow/category', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2214', 'p', '100', '/api/flow/category', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2215', 'p', '100', '/api/flow/category', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2216', 'p', '100', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2217', 'p', '100', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2218', 'p', '100', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2219', 'p', '100', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2220', 'p', '100', '/api/flow/task', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2221', 'p', '100', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2222', 'p', '100', '/api/flow/task', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2223', 'p', '100', '/flow/task/copy-me', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2224', 'p', '100', '/flow/task/copy-me/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2225', 'p', '100', '/api/flow/task', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2226', 'p', '100', '/flow/task/reverted-canceled', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2227', 'p', '100', '/flow/task/reverted-canceled/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2228', 'p', '100', '/api/flow/task', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2229', 'p', '100', '/api/flow/task', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2230', 'p', '100', '/api/flow/task', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2231', 'p', '100', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2232', 'p', '100', '/flow/instance/resubmit/:instanceId', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2233', 'p', '100', '/flow/instance/resubmit/:instanceId/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2234', 'p', '100', '/api/flow/center', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2235', 'p', '100', '/flow/center', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2236', 'p', '100', '/flow/center/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2237', 'p', '100', '/api/flow/delegate', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2238', 'p', '100', '/flow/delegate', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2239', 'p', '100', '/flow/delegate/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2240', 'p', '100', '/api/flow/delegate', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2241', 'p', '100', '/api/flow/delegate', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2242', 'p', '100', '/api/flow/delegate', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2243', 'p', '100', '/api/flow/delegate', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2244', 'p', '100', '/api/flow/message', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2245', 'p', '100', '/flow/message', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2246', 'p', '100', '/flow/message/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2247', 'p', '100', '/api/flow/message', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2248', 'p', '100', '/api/flow/message', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2249', 'p', '100', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2250', 'p', '100', '/flow/instance/template/:templateId', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2251', 'p', '100', '/flow/instance/template/:templateId/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2252', 'p', '10', '/api/core/user', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2253', 'p', '10', '/api/core/user', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2254', 'p', '10', '/api/core/user', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2255', 'p', '10', '/api/core/user', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2256', 'p', '10', '/api/core/user', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2257', 'p', '10', '/api/core/user', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2258', 'p', '10', '/api/core/user', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2259', 'p', '10', '/api/core/user', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2260', 'p', '10', '/api/core/dept', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2261', 'p', '10', '/api/core/dept', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2262', 'p', '10', '/api/core/dept', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2263', 'p', '10', '/api/core/dept', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2264', 'p', '10', '/api/core/dept', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2265', 'p', '10', '/api/core/role', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2266', 'p', '10', '/api/core/role', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2267', 'p', '10', '/api/core/role', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2268', 'p', '10', '/api/core/role', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2269', 'p', '10', '/api/core/role', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2270', 'p', '10', '/api/core/role', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2271', 'p', '10', '/api/core/post', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2272', 'p', '10', '/api/core/post', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2273', 'p', '10', '/api/core/post', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2274', 'p', '10', '/api/core/post', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2275', 'p', '10', '/api/core/post', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2276', 'p', '10', '/api/core/post', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2277', 'p', '10', '/api/core/post', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2278', 'p', '10', '/api/core/menu', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2279', 'p', '10', '/api/core/menu', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2280', 'p', '10', '/api/core/menu', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2281', 'p', '10', '/api/core/menu', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2282', 'p', '10', '/api/core/menu', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2283', 'p', '10', '/api/core/config', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2284', 'p', '10', '/api/core/config', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2285', 'p', '10', '/api/core/config', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2286', 'p', '10', '/api/core/console', 'GET', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2287', 'p', '10', '/api/core/console/list', 'GET', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2288', 'p', '10', '/api/core/console/*', 'GET', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2289', 'p', '10', '/api/core/dept', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2290', 'p', '10', '/api/core/tenant', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2291', 'p', '10', '/api/core/tenant', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2292', 'p', '10', '/api/core/tenant', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2293', 'p', '10', '/api/core/tenant', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2294', 'p', '10', '/api/core/tenant', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2295', 'p', '10', '/template', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2296', 'p', '10', '/flow', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2297', 'p', '10', '/api/flow/category', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2298', 'p', '10', '/flow/category', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2299', 'p', '10', '/flow/category/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2300', 'p', '10', '/api/flow/template', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2301', 'p', '10', '/flow/template', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2302', 'p', '10', '/flow/template/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2303', 'p', '10', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2304', 'p', '10', '/flow/instance/my-started', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2305', 'p', '10', '/flow/instance/my-started/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2306', 'p', '10', '/api/flow/task', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2307', 'p', '10', '/flow/task/pending', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2308', 'p', '10', '/flow/task/pending/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2309', 'p', '10', '/api/flow/task', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2310', 'p', '10', '/flow/task/completed', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2311', 'p', '10', '/flow/task/completed/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2312', 'p', '10', '/api/flow/template', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2313', 'p', '10', '/flow/template/design/:id', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2314', 'p', '10', '/flow/template/design/:id/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2315', 'p', '10', '/api/flow/template', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2316', 'p', '10', '/flow/template/form-design/:id', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2317', 'p', '10', '/flow/template/form-design/:id/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2318', 'p', '10', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2319', 'p', '10', '/flow/instance/start/:templateId', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2320', 'p', '10', '/flow/instance/start/:templateId/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2321', 'p', '10', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2322', 'p', '10', '/flow/instance/detail/:id', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2323', 'p', '10', '/flow/instance/detail/:id/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2324', 'p', '10', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2325', 'p', '10', '/flow/form/leave-request', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2326', 'p', '10', '/flow/form/leave-request/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2327', 'p', '10', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2328', 'p', '10', '/flow/form/expense-claim', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2329', 'p', '10', '/flow/form/expense-claim/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2330', 'p', '10', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2331', 'p', '10', '/flow/form/purchase-request', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2332', 'p', '10', '/flow/form/purchase-request/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2333', 'p', '10', '/api/flow/category', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2334', 'p', '10', '/api/flow/category', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2335', 'p', '10', '/api/flow/category', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2336', 'p', '10', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2337', 'p', '10', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2338', 'p', '10', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2339', 'p', '10', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2340', 'p', '10', '/api/flow/task', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2341', 'p', '10', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2342', 'p', '10', '/api/flow/task', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2343', 'p', '10', '/flow/task/copy-me', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2344', 'p', '10', '/flow/task/copy-me/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2345', 'p', '10', '/api/flow/task', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2346', 'p', '10', '/flow/task/reverted-canceled', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2347', 'p', '10', '/flow/task/reverted-canceled/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2348', 'p', '10', '/api/flow/task', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2349', 'p', '10', '/api/flow/task', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2350', 'p', '10', '/api/flow/task', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2351', 'p', '10', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2352', 'p', '10', '/flow/instance/resubmit/:instanceId', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2353', 'p', '10', '/flow/instance/resubmit/:instanceId/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2354', 'p', '10', '/api/flow/center', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2355', 'p', '10', '/flow/center', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2356', 'p', '10', '/flow/center/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2357', 'p', '10', '/api/flow/delegate', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2358', 'p', '10', '/flow/delegate', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2359', 'p', '10', '/flow/delegate/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2360', 'p', '10', '/api/flow/delegate', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2361', 'p', '10', '/api/flow/delegate', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2362', 'p', '10', '/api/flow/delegate', 'PUT', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2363', 'p', '10', '/api/flow/delegate', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2364', 'p', '10', '/api/flow/message', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2365', 'p', '10', '/flow/message', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2366', 'p', '10', '/flow/message/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2367', 'p', '10', '/api/flow/message', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2368', 'p', '10', '/api/flow/message', 'DELETE', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2369', 'p', '10', '/api/flow/instance', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2370', 'p', '10', '/flow/instance/template/:templateId', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2371', 'p', '10', '/flow/instance/template/:templateId/*', '*', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2398', 'g', '104', 'ceo', '', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2423', 'g', '100', 'JTCEO', '', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2424', 'g', '100', 'ceo', '', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2429', 'g', '1', 'super_admin', '', '', '', '');
INSERT INTO `casbin_rule` VALUES ('2430', 'g', '1', 'ceo', '', '', '', '');

-- ----------------------------
-- Table structure for `migrations`
-- ----------------------------
DROP TABLE IF EXISTS `migrations`;
CREATE TABLE `migrations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `timestamp` bigint(20) NOT NULL,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;

-- ----------------------------
-- Records of migrations
-- ----------------------------
INSERT INTO `migrations` VALUES ('1', '1782230400000', 'CreateTaixuTables1782230400000');
INSERT INTO `migrations` VALUES ('2', '1782319590380', 'CreateTaixuUserProfile1782319590380');

-- ----------------------------
-- Table structure for `plugin_migrations`
-- ----------------------------
DROP TABLE IF EXISTS `plugin_migrations`;
CREATE TABLE `plugin_migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `plugin_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `migration_file` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `executed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_plugin_name` (`plugin_name`),
  KEY `idx_migration_name` (`migration_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='插件安装表';

-- ----------------------------
-- Records of plugin_migrations
-- ----------------------------

-- ----------------------------
-- Table structure for `sa_ai_agent`
-- ----------------------------
DROP TABLE IF EXISTS `sa_ai_agent`;
CREATE TABLE `sa_ai_agent` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `tenant_id` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '租户ID',
  `code` varchar(32) NOT NULL COMMENT 'Agent 标识',
  `name` varchar(64) NOT NULL COMMENT '展示名称',
  `avatar` varchar(255) DEFAULT NULL COMMENT '头像 URL',
  `system_prompt` text NOT NULL COMMENT '系统提示词/角色定义',
  `welcome_message` varchar(500) DEFAULT NULL COMMENT '欢迎语',
  `default_model_id` bigint(20) unsigned DEFAULT NULL COMMENT '默认模型',
  `temperature` decimal(4,2) DEFAULT NULL COMMENT '覆盖温度，NULL 用模型默认',
  `max_history_rounds` int(11) unsigned DEFAULT NULL COMMENT '覆盖历史轮数',
  `status` char(1) NOT NULL DEFAULT '0' COMMENT '0正常 1停用',
  `sort` smallint(5) unsigned NOT NULL DEFAULT '0',
  `remark` varchar(255) DEFAULT '',
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `create_time` datetime DEFAULT NULL,
  `update_time` datetime DEFAULT NULL,
  `delete_time` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_code` (`tenant_id`,`code`,`delete_time`),
  KEY `idx_tenant_status` (`tenant_id`,`status`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COMMENT='AI Agent 角色';

-- ----------------------------
-- Records of sa_ai_agent
-- ----------------------------
INSERT INTO `sa_ai_agent` VALUES ('1', '0', 'default-assistant', '默认助手', null, '你是 FSS 管理系统的 AI 助手。回答简洁准确，使用 Markdown 格式。不确定时请明确说明，不要编造。', '你好，我是 AI 助手，有什么可以帮你？', '1', null, null, '1', '0', '', null, null, '2026-06-21 22:14:10', '2026-06-21 22:32:51', null);

-- ----------------------------
-- Table structure for `sa_ai_chat_message`
-- ----------------------------
DROP TABLE IF EXISTS `sa_ai_chat_message`;
CREATE TABLE `sa_ai_chat_message` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `message_uuid` char(36) NOT NULL COMMENT '消息 UUID',
  `session_id` bigint(20) unsigned NOT NULL COMMENT '会话ID',
  `user_id` int(11) unsigned NOT NULL COMMENT '冗余：所属用户',
  `tenant_id` int(11) unsigned NOT NULL COMMENT '冗余：所属租户',
  `role` varchar(16) NOT NULL COMMENT 'system/user/assistant/tool',
  `content` mediumtext COMMENT 'Markdown 正文',
  `content_format` varchar(16) NOT NULL DEFAULT 'markdown' COMMENT '内容格式',
  `model_id` bigint(20) unsigned DEFAULT NULL COMMENT 'assistant 实际使用的模型',
  `provider_id` bigint(20) unsigned DEFAULT NULL COMMENT 'assistant 实际使用的供应商',
  `parent_id` bigint(20) unsigned DEFAULT NULL COMMENT '父消息，重新生成/编辑分支',
  `seq` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '会话内顺序',
  `status` varchar(16) NOT NULL DEFAULT 'completed' COMMENT 'pending/streaming/completed/error/stopped',
  `error_message` varchar(500) DEFAULT NULL COMMENT '失败原因',
  `prompt_tokens` int(11) unsigned DEFAULT '0',
  `completion_tokens` int(11) unsigned DEFAULT '0',
  `total_tokens` int(11) unsigned DEFAULT '0',
  `latency_ms` int(11) unsigned DEFAULT NULL COMMENT '生成耗时',
  `request_params` json DEFAULT NULL COMMENT '发送时参数快照 temperature 等',
  `metadata` json DEFAULT NULL COMMENT '附件/tool 调用等扩展',
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `create_time` datetime DEFAULT NULL,
  `update_time` datetime DEFAULT NULL,
  `delete_time` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_message_uuid` (`message_uuid`),
  KEY `idx_session_seq` (`session_id`,`seq`),
  KEY `idx_user_tenant` (`user_id`,`tenant_id`),
  KEY `idx_session_model` (`session_id`,`model_id`)
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COMMENT='AI 聊天消息';

-- ----------------------------
-- Records of sa_ai_chat_message
-- ----------------------------

-- ----------------------------
-- Table structure for `sa_ai_chat_session`
-- ----------------------------
DROP TABLE IF EXISTS `sa_ai_chat_session`;
CREATE TABLE `sa_ai_chat_session` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `session_uuid` char(36) NOT NULL COMMENT '对外 UUID，WebSocket 路由用',
  `user_id` int(11) unsigned NOT NULL COMMENT '所属用户',
  `tenant_id` int(11) unsigned NOT NULL COMMENT '所属租户',
  `agent_id` bigint(20) unsigned DEFAULT NULL COMMENT '当前 Agent',
  `title` varchar(200) NOT NULL DEFAULT '新对话' COMMENT '会话标题',
  `default_model_id` bigint(20) unsigned DEFAULT NULL COMMENT '当前选中模型（可随时切换）',
  `summary` text COMMENT '长对话摘要，拼入 system 上下文',
  `summary_up_to_seq` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '已纳入摘要的最大 seq',
  `message_count` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '消息数缓存',
  `last_message_at` datetime DEFAULT NULL COMMENT '最后消息时间',
  `status` char(1) NOT NULL DEFAULT '0' COMMENT '0进行中 1已归档',
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `create_time` datetime DEFAULT NULL,
  `update_time` datetime DEFAULT NULL,
  `delete_time` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_session_uuid` (`session_uuid`),
  KEY `idx_user_tenant` (`user_id`,`tenant_id`,`delete_time`),
  KEY `idx_tenant_last_msg` (`tenant_id`,`last_message_at`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COMMENT='AI 聊天会话';

-- ----------------------------
-- Records of sa_ai_chat_session
-- ----------------------------

-- ----------------------------
-- Table structure for `sa_ai_model`
-- ----------------------------
DROP TABLE IF EXISTS `sa_ai_model`;
CREATE TABLE `sa_ai_model` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `tenant_id` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '租户ID',
  `provider_id` bigint(20) unsigned NOT NULL COMMENT '供应商ID',
  `model_code` varchar(64) NOT NULL COMMENT '模型编码 deepseek-chat/gpt-4o',
  `name` varchar(64) NOT NULL COMMENT '展示名称',
  `context_window` int(11) unsigned NOT NULL DEFAULT '32000' COMMENT '上下文窗口 tokens',
  `max_output_tokens` int(11) unsigned NOT NULL DEFAULT '4096' COMMENT '最大输出 tokens',
  `default_temperature` decimal(4,2) NOT NULL DEFAULT '0.70' COMMENT '默认温度',
  `is_default` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否租户默认模型',
  `status` char(1) NOT NULL DEFAULT '0' COMMENT '0正常 1停用',
  `sort` smallint(5) unsigned NOT NULL DEFAULT '0',
  `remark` varchar(255) DEFAULT '',
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `create_time` datetime DEFAULT NULL,
  `update_time` datetime DEFAULT NULL,
  `delete_time` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_model_code` (`tenant_id`,`model_code`,`delete_time`),
  KEY `idx_provider_id` (`provider_id`),
  KEY `idx_tenant_default` (`tenant_id`,`is_default`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COMMENT='AI 模型配置';

-- ----------------------------
-- Records of sa_ai_model
-- ----------------------------
INSERT INTO `sa_ai_model` VALUES ('1', '1', '1', 'deepseek-chat', 'DeepSeek Chat', '32000', '4096', '0.70', '1', '1', '0', '', null, null, '2026-06-21 22:14:10', '2026-06-21 22:14:10', null);
INSERT INTO `sa_ai_model` VALUES ('3', '1', '2', 'doubao-seed-2-0-pro-260215', 'doubao-seed-2-0-pro-260215', '32000', '4096', '0.70', '0', '1', '0', '', '1', '1', '2026-06-21 22:43:26', '2026-06-21 22:43:26', null);
INSERT INTO `sa_ai_model` VALUES ('4', '0', '3', 'deepseek-chat', 'DeepSeek Chat', '32000', '4096', '0.70', '1', '1', '0', '', null, null, '2026-06-23 17:29:52', '2026-06-23 17:29:52', null);

-- ----------------------------
-- Table structure for `sa_ai_provider`
-- ----------------------------
DROP TABLE IF EXISTS `sa_ai_provider`;
CREATE TABLE `sa_ai_provider` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `tenant_id` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '租户ID，0=平台级',
  `code` varchar(32) NOT NULL COMMENT '供应商标识 deepseek/openai/qwen',
  `name` varchar(64) NOT NULL COMMENT '展示名称',
  `base_url` varchar(255) NOT NULL COMMENT 'API Base URL',
  `api_key_cipher` text COMMENT 'AES-GCM 加密后的 API Key',
  `adapter_type` varchar(32) NOT NULL DEFAULT 'openai_compatible' COMMENT '适配器类型',
  `extra_headers` json DEFAULT NULL COMMENT '额外请求头 JSON',
  `status` char(1) NOT NULL DEFAULT '0' COMMENT '0正常 1停用',
  `sort` smallint(5) unsigned NOT NULL DEFAULT '0' COMMENT '排序',
  `remark` varchar(255) DEFAULT '' COMMENT '备注',
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `create_time` datetime DEFAULT NULL,
  `update_time` datetime DEFAULT NULL,
  `delete_time` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_code` (`tenant_id`,`code`,`delete_time`),
  KEY `idx_tenant_status` (`tenant_id`,`status`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COMMENT='AI 模型供应商';

-- ----------------------------
-- Records of sa_ai_provider
-- ----------------------------
INSERT INTO `sa_ai_provider` (`id`, `tenant_id`, `code`, `name`, `base_url`, `api_key_cipher`, `adapter_type`, `extra_headers`, `status`, `sort`, `remark`, `created_by`, `updated_by`, `create_time`, `update_time`, `delete_time`) VALUES ('1', '1', 'deepseek', 'DeepSeek', 'https://api.deepseek.com/v1', null, 'openai_compatible', null, '1', '0', 'Initial placeholder provider; configure API key in admin panel.', null, null, '2026-06-21 22:14:10', '2026-06-21 22:29:21', null);
INSERT INTO `sa_ai_provider` (`id`, `tenant_id`, `code`, `name`, `base_url`, `api_key_cipher`, `adapter_type`, `extra_headers`, `status`, `sort`, `remark`, `created_by`, `updated_by`, `create_time`, `update_time`, `delete_time`) VALUES ('2', '1', 'doubao', 'Doubao', 'https://ark.cn-beijing.volces.com/api/v3', null, 'openai_compatible', null, '1', '0', 'Initial placeholder provider; configure API key in admin panel.', '1', '1', '2026-06-21 22:42:41', '2026-06-21 22:42:41', null);
INSERT INTO `sa_ai_provider` (`id`, `tenant_id`, `code`, `name`, `base_url`, `api_key_cipher`, `adapter_type`, `extra_headers`, `status`, `sort`, `remark`, `created_by`, `updated_by`, `create_time`, `update_time`, `delete_time`) VALUES ('3', '0', 'deepseek', 'DeepSeek', 'https://api.deepseek.com/v1', null, 'openai_compatible', null, '1', '0', 'Initial placeholder provider; configure API key in admin panel.', null, null, '2026-06-23 17:29:52', '2026-06-23 17:29:52', null);

-- ----------------------------
-- Table structure for `sa_article`
-- ----------------------------
DROP TABLE IF EXISTS `sa_article`;
CREATE TABLE `sa_article` (
  `id` int(10) NOT NULL AUTO_INCREMENT COMMENT '编号',
  `category_id` int(10) NOT NULL COMMENT '分类id',
  `title` varchar(255) NOT NULL DEFAULT '' COMMENT '文章标题',
  `author` varchar(255) DEFAULT NULL COMMENT '文章作者',
  `dept_id` mediumint(10) DEFAULT '0' COMMENT '部门id',
  `tenant_id` mediumint(10) DEFAULT NULL COMMENT '租户id',
  `image` varchar(1000) DEFAULT '' COMMENT '文章图片',
  `describe` varchar(1000) NOT NULL COMMENT '文章简介',
  `content` text NOT NULL COMMENT '文章内容',
  `summary` varchar(500) DEFAULT NULL COMMENT '文章摘要',
  `cover_image` varchar(255) DEFAULT NULL COMMENT '封面图片',
  `category` varchar(100) DEFAULT NULL COMMENT '分类',
  `tags` varchar(500) DEFAULT NULL COMMENT '标签(逗号分隔)',
  `views` int(11) DEFAULT '0' COMMENT '浏览次数',
  `sort` int(10) unsigned DEFAULT '100' COMMENT '排序',
  `status` tinyint(1) unsigned DEFAULT '1' COMMENT '状态',
  `is_link` tinyint(1) DEFAULT '2' COMMENT '是否外链',
  `link_url` varchar(255) DEFAULT NULL COMMENT '链接地址',
  `is_hot` tinyint(1) unsigned DEFAULT '2' COMMENT '是否热门',
  `created_by` int(11) DEFAULT NULL COMMENT '创建者',
  `updated_by` int(11) DEFAULT NULL COMMENT '更新者',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_category_id` (`category_id`) USING BTREE,
  KEY `idx_tenant_dept` (`tenant_id`,`dept_id`) USING BTREE,
  KEY `idx_created_by` (`created_by`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='文章表';

-- ----------------------------
-- Records of sa_article
-- ----------------------------
INSERT INTO `sa_article` VALUES ('1', '1', '科技为农业强国建设插上腾飞之翼', '新华网', '3', '1', 'https://www.news.cn/tech/20251203/51066a5dc41545fa849d49423770ad70/2025120351066a5dc41545fa849d49423770ad70_202512037a03214ec26c4f029d6e1599d07c3779.png', '“十四五”规划提出，完善农业科技创新体系，创新农技推广服务方式，建设智慧农业。5年来，在科技创新的强劲支撑下，14亿人的饭碗端得更牢、农业现代化水平显著提升、产业新动能持续增强，农业强国建设迈上新台阶。', '<p style=\"text-align: justify;\"> &nbsp; &nbsp; &nbsp; &nbsp;“平均亩产1209.1公斤，这标志着全国首个两百万亩玉米‘吨粮田’成功创建。”金秋时节，新疆伊犁哈萨克自治州传来喜讯。这一纪录的诞生，离不开中国农业科学院研发的“玉米密植高产精准调控技术”支撑。依托该技术，位于伊犁的200余万亩玉米高产田亩保苗株数从传统的不足5000株提升到7000—8000株，玉米收获穗数大幅提升。</p><p style=\"text-align: justify;\">　　这只是我国科技强农、粮食增产增收的一个缩影。“十四五”以来，我国粮食总产量始终保持在1.3万亿斤以上。2024年粮食总产量更是首次突破1.4万亿斤，比2020年增产740亿斤。</p><p style=\"text-align: justify;\">　　习近平总书记强调，发展现代农业，建设农业强国，必须依靠科技进步，让科技为农业现代化插上腾飞的翅膀。</p><p style=\"text-align: justify;\">　　“十四五”规划提出，完善农业科技创新体系，创新农技推广服务方式，建设智慧农业。5年来，在科技创新的强劲支撑下，14亿人的饭碗端得更牢、农业现代化水平显著提升、产业新动能持续增强，农业强国建设迈上新台阶。</p><p style=\"text-align: justify;\">　　科技铸“芯”，夯实大国粮仓之基</p><p style=\"text-align: justify;\">　　国以农为本，农以种为先，种子被誉为农业的“芯片”。前不久，四川省富顺县水稻百亩超高产攻关片进行实割实测，再生稻亩产达到494.81公斤，加上此前测产中稻亩产807.13公斤，合计亩产突破1300公斤。取得这一成绩的背后，是“甬优4949”等高产突破性品种的选育和“中稻+再生稻”生产模式的推广。</p><p style=\"text-align: justify;\">　　水稻是我国第一大口粮。“十四五”时期全国多地选育出一批水稻突破性品种：安徽农业大学水稻栽培团队推广自育水稻品种，帮助当地农户水稻亩产增至800公斤；湖南杂交水稻研究中心选育出“西子3号”，推动解决部分受重金属污染地区“镉大米”问题；国家耐盐碱水稻技术创新中心培育出“箐两优3261”，填补了我国华南滨海盐碱区暂无强耐盐、多抗、优质杂交稻品种的空白……</p><p style=\"text-align: justify;\">　　习近平总书记指出，中国人的饭碗要牢牢端在自己手中，就必须把种子牢牢攥在自己手里。</p><p style=\"text-align: justify;\">　　作为我国另一大口粮，小麦育种的创新步伐也不断提速。2025年，西北农林科技大学一次性通过国家审定12个新品种，覆盖半冬性、冬性、春性类型，在抗倒伏等方面实现全面突破。这些为不同生态区“量身定制”的品种，在丰富我国小麦品种的同时，也大幅提升了小麦产能潜力。截至目前，西农小麦系列品种累计推广面积已达18亿亩，为保障国家粮食安全提供了坚实的种源支撑。</p><p style=\"text-align: justify;\">　　“十四五”以来，我国深入实施种业振兴行动，育成了一批生产急需的重大品种，选育出优质高产水稻、节水抗病小麦、机收籽粒玉米、高油高产大豆等急需品种，农作物自主选育品种面积占比超过了95%，做到了“中国粮”主要用“中国种”。</p><p style=\"text-align: justify;\">　　“去年全国粮食亩产394.7公斤，比‘十三五’末提高了12.5公斤，单产提升对我国粮食产量增长的贡献超过60%，有些年份会超过80%。”农业农村部党组书记、部长韩俊表示，“十四五”以来，农业农村部深入实施国家粮食安全战略，“以我为主、立足国内、确保产能、适度进口、科技支撑”，坚持产量产能、生产生态、增产增收一起抓，强化藏粮于地、藏粮于技，全方位夯实粮食安全根基。</p><p style=\"text-align: justify;\">　　智慧提“效”，驱动耕作方式变革</p><p style=\"text-align: justify;\">　　气象墒情传感器、智能虫情测报站等设备如同“千里眼”，与空中无人机巡航、地面机器狗巡检形成立体监测网络。这是日前科技日报记者在北京市昌平区的天汇园果园见到的一幕。</p><p style=\"text-align: justify;\">　　“目前，该果园环境和土壤墒情覆盖10余项指标，虫情识别准确率达90%，种植生产信息化率超过95%，同时土壤成分快检技术能在30分钟内完成土壤成分‘体检’，辅助实现果园虫情和灾情等早预警、早干预。”北京市智慧农业创新团队岗位专家吴建伟介绍，该果园管理从“经验驱动”转向“数据驱动”，为果树生长提供了全天候守护。</p><p style=\"text-align: justify;\">　　在四川省成都市新都区稻菜现代农业园区，当地自主研发的农业巡检机器人已代替人工开展巡检工作；在浙江省衢州市龙游县田间地头，一架植保无人机3小时就能完成300亩农田的喷药流程，相当于40多个人整整一天的工作量……</p><p style=\"text-align: justify;\">　　“十四五”以来，类似的农业新场景新模式不断涌现，现代农业设施装备持续普及应用。我国先后支持建设国家智慧农业创新应用项目116个，深入开展国产化智慧农业技术的中试熟化、推广应用，探索形成了一批信息技术与农机农艺相融合的节本增产增效技术模式。</p><p style=\"text-align: justify;\">　　习近平总书记指出，农业科技创新要着力提升创新体系整体效能，农业科技工作要突出应用导向，把论文写在大地上。</p><p style=\"text-align: justify;\">　　5年来，我国农业科技创新体系整体效能显著提升。我国充分利用物联网、大数据、人工智能等现代信息技术发展智慧农业，并研制出一批先进智能适用的农机装备。</p><p style=\"text-align: justify;\">　　“随着智能农机加快推广，全国安装北斗终端的农机约200万台，植保无人机年作业面积超过4.1亿亩。人工智能、农业机器人等新技术与农业生产经营加速融合，精准播种、变量施肥、智慧灌溉、精准饲喂、环境控制等逐渐普及。”农业农村部市场与信息化司司长雷刘功介绍。</p><p style=\"text-align: justify;\">　　这些前沿技术的落地应用，正是农业科技现代化推动农业现代化的生动实践。“十四五”以来，我国坚持用现代设施装备武装农业，用现代科学技术服务农业，推动农业现代化水平不断提高。2024年底，农业科技进步贡献率已经达到了63.2%，农作物耕种收综合机械化率超过75%。</p><p style=\"text-align: justify;\">　　创新延“链”，拓宽食物供给版图</p><p style=\"text-align: justify;\">　　近日，蒙牛集团携多款产品参加第八届中国国际进口博览会，展示其发展新质生产力的最新成果。“我们打造的全球液态奶行业首座‘灯塔工厂’，已成为全球乳业最高人效比的新标杆，是中国乳业抢占全球智能制造新高地的生动写照。”中粮集团副总经理、蒙牛乳业董事长庆立军介绍。这座“灯塔工厂”通过实施30多项第四次工业革命技术，实现了“百人百亿”的极致人效比——100名员工，年产能达百万吨，创造产值百亿元。</p><p style=\"text-align: justify;\">　　今天，科研创新已成为发展现代化海洋牧场的强大引擎。南方海洋实验室研发“珠海琴”等多功能融合的新型组合式结构加强型养殖平台，为海洋养殖带来新变革；珠海市海洋集团形成海工型养殖装备设计、建造、施工和运维等全产业链条，成功研发“格盛一号”养殖平台，订单水体总量相当于新开拓28.25万亩耕地。</p><p style=\"text-align: justify;\">　　习近平总书记指出，要树立大农业观、大食物观，农林牧渔并举，构建多元化食物供给体系。</p><p style=\"text-align: justify;\">　　“十四五”以来，我国突出科技支撑，强化要素保障，努力向森林要食物，向草原要食物，向江河湖海要食物，向设施农业要食物，向植物动物微生物要热量、要蛋白，多元化食物供给体系加快构建。</p><p style=\"text-align: justify;\">　　一组数据表明，农业科技创新正通过看得见的方式，让老百姓的餐桌品类变得愈发丰富——2024年，我国肉蛋奶等畜产品总量达到1.75亿吨，比2020年增加2778万吨，增长18.8%；水产品总产量达到7358万吨，比2020年增长12.3%，水产品总产量持续36年居全球第一。</p><p style=\"text-align: justify;\">　　党的二十届四中全会审议通过的《中共中央关于制定国民经济和社会发展第十五个五年规划的建议》提出，“统筹发展科技农业、绿色农业、质量农业、品牌农业，把农业建成现代化大产业”。科技创新能够催生新产业、新模式、新动能，是发展新质生产力的核心要素。韩俊表示，加快建设农业强国，必须清醒认识到农业科技国际竞争新形势，把农业科技创新放在更加突出的位置，紧盯世界农业科技前沿，加快突破农业关键核心技术，努力抢占农业科技创新制高点，塑造农业农村发展新动能新优势，培育壮大农业新质生产力。</p>', null, null, null, null, '5', '100', '1', '2', '', '2', '100', '1', '2024-06-02 22:55:25', '2026-01-10 11:13:25', null);
INSERT INTO `sa_article` VALUES ('2', '1', '商业航天稳步快跑 “太空旅游”渐行渐近', '新华网', '3', '1', 'https://www.news.cn/tech/20251124/c7cb9d4e405c4c82b78a8f861889cb22/20251124c7cb9d4e405c4c82b78a8f861889cb22_20251124044f95bbab864da2b0c30861aa41279b.png', '业界普遍认为，以可复用火箭为代表的核心技术突破是商业航天提速的关键支撑。据统计，2025年底至2026年初，我国可复用火箭技术将进入密集首飞期，包括蓝箭航天“朱雀三号”、中科宇航“力箭二号”、星际荣耀“双曲线三号”和星河动力“智神星一号”在内的多款可复用火箭将迎来首飞。', '<p style=\"text-align: justify;\"> &nbsp; &nbsp; &nbsp; &nbsp;可搭载7名乘客穿越卡门线，体验约4分钟失重体验……记者从11月22日在京开幕的第四届中国空间科学大会上了解到我国太空旅游的最新进展。与会专家学者认为，随着产业链条不断完善、核心技术持续突破，我国商业航天已迈入稳步快跑的发展新阶段，曾经遥不可及的“太空旅游”正加速走进现实。</p><p style=\"text-align: justify;\">  记者在第四届中国空间科学大会同期举行的“航天新技术、新成果展”上看到，我国首型面向太空旅游的可重复使用飞行器力鸿二号的模型吸引了众多参观者。中科宇航展台工作人员告诉记者，力鸿二号将采用“箭船分离”的方式将乘客送上太空：飞到既定高度之后，载人舱与火箭分离，继续飞越100公里的卡门线，开始约4分钟的失重段，之后返回地面，以伞降的方式着陆，火箭也将垂直着陆回收。“我们的目标是让力鸿二号可重复使用超30次，这样就能把飞行成本降下来，让更多的人体验太空旅游。”</p><p style=\"text-align: justify;\">  我国商业航天的快速发展让太空旅游渐行渐近。业界普遍认为，以可复用火箭为代表的核心技术突破是商业航天提速的关键支撑。据统计，2025年底至2026年初，我国可复用火箭技术将进入密集首飞期，包括蓝箭航天“朱雀三号”、中科宇航“力箭二号”、星际荣耀“双曲线三号”和星河动力“智神星一号”在内的多款可复用火箭将迎来首飞。</p><p style=\"text-align: justify;\">  不仅火箭研制加速突破，卫星应用也在不断拓展。此次展会上，微纳星空等卫星企业也带来了最新的研发成果。微纳星空品牌总监刘晓光介绍，即将发射的“全天候卫士”MN200S-2（01B）星是公司自主研制的商业X波段相控阵雷达成像领域的技术标杆型卫星，可广泛应用于应急救灾、海洋维权、国土安全、生态监测、智慧城市建设等场景，并可实现多星高密度堆叠发射，为后续卫星规模化组网编队提供关键技术验证与工程实践依据。“随着国家低轨卫星互联网的能力建设牵引，微纳星空已经开启批量化、低成本的卫星制造。”</p><p style=\"text-align: justify;\">  业界认为，目前我国已形成覆盖火箭研制、卫星制造、发射服务、地面应用的完整商业航天产业链，产业集群效应逐步显现。在北京，“南箭北星”的产业格局已显露雏形：亦庄新城正在打造全国首个商业航天共性科研生产基地——火箭大街，海淀区作为“北星”的核心承载区，已集聚涵盖商业卫星制造、测运控、运营及数据应用的近200家相关企业。“在此基础上，海淀正全力推进卫星小镇‘两区一平台’的建设：先导区目前已有40余家商业航天企业聚集；紧邻航天城的卫星小镇核心区54万平方米空间预计2026年6月竣备，将重点引入卫星上下游企业；同时，卫星小镇拟建公共服务平台，提供卫星整星及组部件的力学、热真空、抗辐射等多种测试服务。”卫星小镇核心区对接人段叶叶介绍。</p><p style=\"text-align: justify;\">  “我国发展商业航天的优势是人多、力量大、竞争强，技术和产品能够快速迭代，紧跟国际趋势。”中国科学院微小卫星创新研究院副院长张永合在接受记者专访时表示，但目前我国商业航天企业和人才大多集中在制造领域，“还需要更多能创造任务的人，有非常前沿的想法，有改变当前航天模式的颠覆性路径。”</p><p style=\"text-align: justify;\">  张永合认为，商业航天关键是要创造需求，“比如太空旅游就是商业航天创造的需求，将人们日常生活中的旅游延伸到太空中去，在产业上就属于增量。”未来，低空经济、空间互联网等也将打开想象空间。“有了坚实的技术底座，新的产业形态就会自然而然生长出来。”</p><p style=\"text-align: justify;\">  不过，业内专家也指出，我国商业航天发展仍面临体制机制创新不足、部分核心技术有待突破等挑战。从政策层面来看，近年来国家持续加大对商业航天的支持力度，相关扶持政策和行业规范正在逐步完善，旨在优化市场环境、加大核心技术研发支持，为商业航天高质量发展营造良好生态，推动太空旅游等新业态逐步走向成熟。</p><p style=\"text-align: justify;\">  业内普遍认为，商业航天已成为航天强国建设的重要增长点。从运载火箭重复使用技术突破到卫星应用场景拓展，随着技术持续成熟、产业链不断完善和政策环境优化，未来“上太空”有望从专业探索逐步走向大众体验，中国商业航天也将在全球太空经济格局中占据重要地位。</p><p><br></p>', null, null, null, null, '1', '100', '1', '2', '', '2', '100', '1', '2024-06-02 22:56:47', '2026-01-10 11:13:47', null);
INSERT INTO `sa_article` VALUES ('3', '2', '以数字经济为引擎加快推进中国式现代化', '新华网', '12', '1', 'https://www.news.cn/tech/20251023/0cb8f0bcb7874992b8d431abdd7331a9/202510230cb8f0bcb7874992b8d431abdd7331a9_2025102332abb363b12744eb9f725ce395f16e4a.png', 'The Athletic报道，阿森纳理疗师乔丹-里斯即将加盟曼联，成为红魔的首席理疗师。曼联首席理疗师罗宾-萨德勒已于今年一月离开俱乐部', '<p style=\"text-align: justify;\"> &nbsp; &nbsp; &nbsp; &nbsp;随着中国式现代化不断向前推进，中国迎来了数字经济发展的新机遇。在数字经济快速发展的背景下，中国式现代化的内涵得以拓展，现代化动力得以重塑，现代化新动能得以培育，现代化新优势得以形成。数字技术创新、实体经济与数字经济融合、产业数字化、数字产业化成为推进中国式现代化的重要驱动力量。</p><p style=\"text-align: justify;\">  在数字经济推动下，现代化由工业经济时代的现代化向数字经济时代的现代化转变，在这一大背景下需要在理论上研究数字经济赋能中国式现代化的逻辑和机制，需要深入探讨中国式现代化如何紧紧抓住数字经济发展带来的新机遇，以数字化的知识和信息作为关键生产要素，以数字技术为核心驱动力，在数据要素和数字技术的双轮驱动下推动中国式现代化走上新征程。</p><p style=\"text-align: justify;\">  南京大学数字经济与管理学院任保平教授的专著《数字经济赋能中国式现代化》于2025年在江苏人民出版社出版，全书共17章，35.8万字。该书立足世界范围内数字化浪潮下的经济现代化背景，从理论与实践两个方面研究了数字经济发展对中国式现代化的赋能作用。</p><p style=\"text-align: justify;\">  在理论层面，该书研究了数字经济发展对中国式现代化的影响、数字经济与中国式现代化的有机衔接，数字经济背景下中国式现代化目标的重塑、数字经济与中国式现代化深度融合的逻辑机制，数字经济背景下中国式现代化的延伸和拓展。在实践层面，从中国式现代化的不同方面具体研究了数字经济的赋能作用，具体包括数字经济赋能中国式新型工业化、新型城镇化、科技现代化、农业农村现代化、产业现代化和科技现代化。</p><p style=\"text-align: justify;\">  该书的核心观点主要有以下方面。一是，中国式现代化战略在数字化转型背景下发生的一系列拓展。促进工业化与信息化的融合发展，以数字化带动工业化发展，加大数字技术研发力度，大力发展数字产业。以数字化带动农业现代化，补足中国式现代化短板。协同匹配数字经济时代的创新供求，提升产业技术创新能力。促进企业数字化转型，引领数字经济发展。协调产业数字化与数字产业化，推进产业基础现代化。加快新型基础设施建设，提升基础设施支撑能力。构建数字平台体系，打造现代化经济新形态。</p><p style=\"text-align: justify;\">  二是，以数字经济发展培育中国式现代化新优势。针对数字经济带来的现代化新变化，研究了数字经济对中国式现代化的引擎作用，认为目前中国式现代化正处于数字经济蓬勃发展带来无数新机遇的时代，我们要抓住数字经济发展带来的新机遇，以数字经济推动中国式现代化的新发展。</p><p style=\"text-align: justify;\">  三是，阐释数字经济赋能中国式现代化的逻辑。在理论上深刻阐释数字经济如何成为中国式现代化的新引擎，数字经济作为新引擎对中国式现代化赋能的驱动机制和路径，论证数字经济发展赋能中国式现代化在目标、路径和战略上的延伸和拓展，为数字经济赋能中国式现代化提供了一个理论框架。</p><p style=\"text-align: justify;\">  四是，研究数字经济全面赋能中国式现代化的机制。中国式经济现代化涉及多方面内容，包括科技现代化、工业现代化、农业现代化、服务业现代化、产业链现代化、城市现代化、区域现代化、城市现代化、生态现代化、企业现代化、人的现代化和治理现代化，数字经济应该从上述方面赋能中国式现代化。</p><p style=\"text-align: justify;\">  五是，提出了以数字经济培育中国式现代化新优势的路径。数字经济培育中国式现代化的新优势包括需求端的动力新优势、供给端的效率新优势等。需要从数字化转型的创新能力、基础设施的供给能力、数字化转型的战略支撑能力，数字化转型的保障能力等方面研究数字经济发展培育中国式现代化新优势的实现路径。而且，需要从效率变革机制、动力变革机制和质量变革机制等方面研究数字经济赋能中国式现代化新优势培育的机制，从数字产业化、产业数字化、产学研协同创新、劳动力质量和相关配套制度等方面实现数字经济培育中国式现代化的新优势，全面展示数字经济赋能中国式现代化中的应用场景。</p>', null, null, null, null, '2', '100', '1', '2', '', '2', '1', '1', '2024-06-02 22:58:41', '2026-01-10 11:13:01', null);
INSERT INTO `sa_article` VALUES ('4', '2', '2025腾讯全球数字生态大会在深圳举行', '新华网', '8', '2', 'https://www.news.cn/tech/20250918/a8a0f6e1a6d740188db7752e247518bb/20250918a8a0f6e1a6d740188db7752e247518bb_202509184f78f2904fa2456db9537d878cb89166.jpg', '5月26日晚上18：00，中超第14轮，深圳新鹏城主场迎战上海申花，上半场马莱莱补射斩获赛季第6球，半场战罢，申花暂1-0新鹏城', '<p><br></p><div data-w-e-type=\"video\" data-w-e-is-void>\n<video poster=\"\" controls=\"true\" width=\"auto\" height=\"auto\"><source src=\"https://vodpub6.v.news.cn/yqfbzx-original/20250918/20250918a8a0f6e1a6d740188db7752e247518bb_XxjfceC000090_20250917_CBVFN0A001.mp4\" type=\"video/mp4\"/></video>\n</div><p><span style=\"color: rgb(0, 0, 0);\"> &nbsp; &nbsp; &nbsp; &nbsp;9月16日，2025腾讯全球数字生态大会在深圳举行，会上公布多项AI技术和产品最新进展，并宣布全面开放腾讯AI落地能力及优势场景，助力“好用的AI”在千行百业中加速落地。</span></p><p><br></p>', null, null, null, null, '3', '100', '1', '2', '', '2', '1', '1', '2024-06-02 22:59:41', '2026-01-10 13:42:34', null);
INSERT INTO `sa_article` VALUES ('5', '3', '秀我中国丨中国小机器人“勇闯”美国CES', '新华网', '121', '1', 'https://www.news.cn/tech/20260109/b2c43e2b0d1e43a98840c33e37fbbc73/20260109896bd0b56c18435987243f0f5dc01d67_202601099d0953f9999949a9b55e9d212d7bf773.jpg', '2026年美国拉斯维加斯消费电子展（CES）6日至9日举行，首次亮相海外展会的中国小机器人“启元Q1”刚一登场就成为焦点，凭借其出色表现“圈粉”海外。', '<p><br></p><div data-w-e-type=\"video\" data-w-e-is-void>\n<video poster=\"https://vodpub6.v.news.cn/yqfbzx-original/20260109/image/2ff2c0d5-4060-400d-8640-b41a0da5af1f.jpg\" controls=\"true\" width=\"360\" height=\"640\"><source src=\"https://vodpub6.v.news.cn/yqfbzx-original/20260109/20260109896bd0b56c18435987243f0f5dc01d67_XxjfceC000165_20260109_CBVFN0A001.mp4\" type=\"video/mp4\"/></video>\n</div><p style=\"text-align: left;\"><span style=\"color: rgb(0, 0, 0);\"> &nbsp; &nbsp; &nbsp; &nbsp;2026年美国拉斯维加斯消费电子展（CES）6日至9日举行，首次亮相海外展会的中国小机器人“启元Q1”刚一登场就成为焦点，凭借其出色表现“圈粉”海外。</span></p>', null, null, null, null, '3', '100', '1', '2', '', '2', '1', '1', '2024-06-02 23:01:17', '2026-01-10 13:42:24', null);
INSERT INTO `sa_article` VALUES ('6', '3', 'AI助力药物虚拟筛选提速百万倍 开启后AlphaFold时代创新药', '新华网', '1', '1', 'https://www.news.cn/tech/20260109/2e0f65d6733a4e2588a97dfe96593a09/202601092e0f65d6733a4e2588a97dfe96593a09_202601090012b088f5604e22a77ae70f8656f466.jpg', '团队与清华大学闫创业教授团队合作，在去甲肾上腺素转运体（NET）的临床相关靶点上开展了系列生物实验验证。', '<p><span style=\"color: rgb(0, 0, 0);\"> &nbsp; &nbsp; &nbsp; &nbsp;1月9日，清华大学智能产业研究院（AIR）联合清华大学生命学院、清华大学化学系在《科学》杂志发表论文《深度对比学习实现基因组级别药物虚拟筛选》。该论文研发了一个AI驱动的超高通量药物虚拟筛选平台DrugCLIP, 筛选速度对比传统方法实现百万倍提升，同时在预测准确率上也取得显著突破。依托该平台，团队打通了从AlphaFold结构预测到药物发现的关键通道，首次完成了覆盖人类基因组规模的药物虚拟筛选，为后AlphaFold时代的创新药物发现带来新可能性。</span></p><p><img src=\"https://www.news.cn/tech/20260109/2e0f65d6733a4e2588a97dfe96593a09/202601092e0f65d6733a4e2588a97dfe96593a09_2026010932fb993ce4734583aa3e4e861e536cff.png\" alt=\"\" data-href=\"\" style=\"\"/></p><p style=\"text-align: justify;\"> &nbsp; &nbsp;长期以来，药物研发面临“高风险、高投入、低成功率”的难题，在靶点发现与先导化合物筛选阶段，受限于传统工具的计算能力，绝大多数潜在靶点和化合物仍未被充分探索。如何在广阔的生物与化学空间中精准高效地发现活性化合物，是当前创新药物研发面临的核心挑战。</p><p style=\"text-align: justify;\">  据了解，为突破虚拟筛选规模瓶颈，DrugCLIP创新性地构建了蛋白口袋与小分子的“向量化结合空间”，将传统基于物理对接的筛选流程转化为高效的向量检索问题。该模型结合对比学习、3D结构预训练与多模态编码技术，能在三维结构层面精准建模蛋白-配体间的相互作用。训练后的高潜力分子将自然聚集于目标蛋白口袋的向量邻域，能够有效支撑快速的大规模虚拟筛选。依托这一机制，DrugCLIP在128核CPU+8张GPU的计算节点上，能实现毫秒级打分与万亿级日吞吐能力，筛选100万个候选分子仅需0.02秒，日处理能力达31万亿次，对比传统方法实现了百万倍提升。</p><p style=\"text-align: justify;\"><img src=\"https://www.news.cn/tech/20260109/2e0f65d6733a4e2588a97dfe96593a09/202601092e0f65d6733a4e2588a97dfe96593a09_2026010902fd55e1493f4741a2f10b4480ee398e.png\" alt=\"\" data-href=\"\" style=\"\"></p><p style=\"text-align: justify;\"> &nbsp; &nbsp;团队与清华大学闫创业教授团队合作，在去甲肾上腺素转运体（NET）的临床相关靶点上开展了系列生物实验验证。团队使用DrugCLIP模型从160万个候选分子中筛选出约100个高评分分子，同位素配体转运实验检测显示，其中15%为有效抑制剂，其中12个分子结合能力优于现有抗抑郁药物安非他酮。相关复合物结构已通过冷冻电镜解析，进一步验证了DrugCLIP筛选结果的生物学可信度。</p><p style=\"text-align: justify;\">  值得关注的是，DrugCLIP支持对AlphaFold预测的蛋白结构和apo（无配体）状态下的蛋白口袋进行筛选，扩大了其在真实药物发现场景中的适用性。团队和清华大学刘磊教授团队合作，针对E3泛素连接酶TRIP12（thyroid hormone receptor interactor 12）进行了虚拟筛选与实验验证。过往研究发现，TRIP12是多种肿瘤、帕金森综合征的潜在靶点，但是TRIP12缺少已知的小分子配体和复合物结构。团队使用DrugCLIP模型，从160万个候选分子中高通量筛选出约50个高评分分子，SPR实验证实，其中10个分子与TRIP12有结合能力，两个亲和力较高的分子也对TRIP12的泛素连接酶活性有一定的抑制活性。</p><p style=\"text-align: justify;\">  此外，依托DrugCLIP，团队首次完成了人类基因组规模的虚拟筛选项目，覆盖约1万个蛋白靶点、2万个结合口袋，分析超过5亿个小分子，富集出200万余个高潜力活性分子，构建了目前已知最大规模的蛋白-配体筛选数据库。该数据库已面向全球科研社区开放，为基础研究与早期药物发现提供了强大数据支持。</p><p style=\"text-align: justify;\">  DrugCLIP平台现已免费开放，用户无需本地部署，通过网页上传蛋白结构即可启动筛选任务。平台集成口袋/分子编码、向量检索、可视化与结果分析等功能，支持多种分子库调用与自定义上传，广泛适用于科研机构与企业用户。</p><p style=\"text-align: justify;\">  未来，DrugCLIP将与科研产业生态合作伙伴深度合作，在抗癌、传染病、罕见病等方向加速新靶点与First-in-class药物的发现。团队将持续优化引擎性能、拓展支持模态，助力构建一个更智能、高效与普惠的全球药物创新生态。</p>', null, null, null, null, '4', '100', '1', '2', '', '2', '1', '1', '2024-06-02 23:02:40', '2026-01-10 13:38:51', null);
INSERT INTO `sa_article` VALUES ('7', '4', '高度重视低空经济为哪般', '新华网', '4', '1', 'https://www.news.cn/tech/20250312/c0453593a495424780c5424c054a1d4d/20250312c0453593a495424780c5424c054a1d4d_2025031215d8945b560d4d169997f7745d0ef56f.jpg', '当前，我国低空经济正处于市场培育初期，关键技术的实用性和商业价值仅得到初步验证，但已彰显出广阔的增长空间', '<p style=\"text-align: justify;\"> &nbsp; &nbsp; &nbsp; &nbsp;近年来，低空经济成为全球发达经济体角逐的重要方向。虽然世界范围内低空经济还处于培育初期阶段，但是美国、日本、欧盟等国家和地区已经重点围绕场景开发应用、交通管理能力、运行技术验证、系统标准体系等方面积极出台和完善相关政策，加快发展低空经济。</p><p style=\"text-align: justify;\">  低空经济是依托低空飞行活动牵引串联的一系列相互关联的产业经济活动，不仅包括上游生产制造飞行器所必需的材料、零部件及分系统的行业企业，还包括中下游低空飞行器组装集成制造和测试试飞、设施配套及低空服务等领域。低空经济产业链条长、产业关联性强、应用场景丰富，具有战略引领性、高增长潜力等显著特征，既可以推动现代农牧业、先进制造业、现代服务业深度融合发展，又能够扩大有效投资、提振消费需求、提升创新能力。世界主要国家高度重视低空经济发展，就是因为看好其发展前景。</p><p style=\"text-align: justify;\">  当前，我国低空经济正处于市场培育初期，关键技术的实用性和商业价值仅得到初步验证，但已彰显出广阔的增长空间。未来随着技术迭代升级和商业模式逐步成熟，低空经济的高增长潜力将会进一步释放，更容易实现相关产业企业的群体性爆发成长，有望成为拉动经济增长的新引擎。</p><p style=\"text-align: justify;\">  一方面，低空飞行器的产业规模体量加快增长、产业生态持续完善。目前，我国无人机制造国际竞争力逐步增强，消费级无人机世界领先优势突出。截至2023年底，我国民用无人机研制企业已超过2300家，量产的无人机产品超过1000款。2023年，我国民用无人机产业规模达到1174.3亿元，同比增长32%。同时，新一代信息技术、新材料、新能源加速与航空科学技术融合发展，推动低空飞行器动力装备及系统、传感器、飞控系统等相关技术加速迭代，绿色高效、安全低噪的飞行器设计、制造与验证技术也持续更新升级。</p><p style=\"text-align: justify;\">  另一方面，体量巨大、类型多样的应用场景持续涌现，牵引低空服务快速释放动能。运营航空器大幅增加，《2023—2024中国民用无人驾驶航空发展报告》显示，截至2024年8月底，我国无人机实名登记数达198.7万架，比2023年底增加72万架；共颁发无人机驾驶员执照22万本，比2023年底增加13.9%。随着影视航拍、航空运动、空中观光游览等低空文旅应用场景快速发展，低空经济能为满足人民群众美好生活需求提供新供给。2023年，横店“航空＋影视＋旅游”交旅融合案例入选第一批交通运输与旅游融合发展十佳案例；2024年，敦煌“飞天”通用航空项目等航空旅游产品案例入选第二批交通运输与旅游融合发展示范案例。低空旅游市场潜力开始显现。</p><p style=\"text-align: justify;\">  同时，低空经济在农业植保、现代物流等行业领域的发展应用不断深入。随着无人机应用技术不断成熟和应用场景持续丰富，“农林牧副渔”多场景作业不断拓展，农业无人机服务市场规模呈蓬勃发展态势。2024年，全国植保无人机的保有量达到25.1万架，作业面积更是高达26.7亿亩次，同比增长近25%。从全球看，上世纪80年代以来，美国农业植保无人机作业渗透率超过50％，日本60％的稻田采用无人机进行植保作业。相较而言，我国农业无人机作业渗透率还比较低，有很大发展空间。在低空物流领域，以无人机为载运工具的无人化配送成为优化城市物流的重要方向，这能有效解决传统物流配送模式面临的劳动力成本、运输成本大幅攀升以及物资配送流通效率低下等诸多问题。在“低空+”领域，低空经济赋能社会治理成效突出，促进巡检、应急救援、城市管理、森林防火、医疗救护等公共服务快速发展。实践中，北京延庆、湖北武汉等地已采用电力线路无人机智能巡检，有效降低了巡检成本，提升了巡检效率。</p><p style=\"text-align: justify;\">  但也要看到，我国低空经济发展还存在一些问题，如统筹发展和安全有短板、产业融合化发展不足、空域管理协同机制尚不健全、基础设施建设相对滞后等。对此，要从突出集群融合、强化科技创新、加强设施建设等方面综合施策，将低空经济的发展潜力充分释放出来。</p><p style=\"text-align: justify;\">  一是突出集群融合，加快培育壮大低空经济产业集群，以市场需求为牵引、以科技创新为驱动，积极完善产业生态、谋划应用场景，推进低空制造业集群化发展。二是强化科技创新，聚焦低空经济创新链薄弱环节，加大科技创新投入，加快提升低空技术支撑能力。三是加强设施建设，构建低空经济基础设施综合保障体系，坚持绿色发展、节约集约，统筹推进通用机场、电动垂直起降飞行器起降场、固定运营基地、飞行服务站等地面配套基础设施建设，推进低空飞行通信、导航、气象监测等信息基础设施建设，加速低空经济智联网络设施建设。此外，还要统筹发展和安全，加强低空飞行器监控防护，强化低空安全技术攻关，提升空域精细化管理能力。坚持包容审慎的安全风险管控理念，建设监管服务体系，建立灵活调配、动态高效的低空空域管理使用机制，增强管理的协同性与联动性。</p>', null, null, null, null, '11', '100', '1', '2', '', '2', '1', '1', '2024-06-02 23:04:23', '2026-01-10 13:43:44', null);
INSERT INTO `sa_article` VALUES ('8', '4', '国家发改委成立低空经济发展司', '新华网', '1', '1', 'https://www.news.cn/tech/20241231/3f5396024a9749ee863292c04c7119dc/202412313f5396024a9749ee863292c04c7119dc_2024123101c42d384b83467f835ffd286af095d4.jpg', '近日，低空经济发展司召开推动低空基础设施建设座谈会和推动低空智能网联系统建设专题座谈会..', '<p style=\"text-align: justify;\"> &nbsp; &nbsp; &nbsp; 记者从国家发展和改革委员会官方网站获悉，低空经济发展司已正式成立。</p><p style=\"text-align: justify;\">　　低空经济发展司的具体职责是拟订并组织实施低空经济发展战略、中长期发展规划，提出有关政策建议，协调有关重大问题等。</p><p style=\"text-align: justify;\">　　近日，低空经济发展司召开推动低空基础设施建设座谈会和推动低空智能网联系统建设专题座谈会。</p><p style=\"text-align: justify;\">　　在推动低空基础设施建设座谈会上，低空经济发展司负责同志同自然资源部、生态环境部等部委和有关中央企业进行座谈，了解相关领域低空经济典型场景应用和相关基础设施建设发展情况，并就推动低空基础设施有序规划建设进行交流。</p><p style=\"text-align: justify;\">　　在推动低空智能网联系统建设专题座谈会上，低空经济发展司负责同志与通信、导航方面有关专家进行座谈，就低空智能网联系统建设进行交流。</p>', null, null, null, null, '6', '100', '1', '2', '', '2', '1', '1', '2024-06-02 23:04:23', '2026-04-23 23:21:09', null);
INSERT INTO `sa_article` VALUES ('9', '1', '多租户系统架构与权限设计探讨', 'admin', '1', '2', 'http://127.0.0.1:8000/uploads/2026/03/28/69c7a3b2058589.44968839.webp', '多租户系统架构与权限设计探讨', '<p>多租户系统架构与权限设计探讨多租户系统架构与权限设计探讨</p><p>多租户系统架构与权限设计探讨</p><p>多租户系统架构与权限设计探讨</p>', null, null, null, null, '0', '100', '1', '2', '', '2', '1', '1', '2026-04-23 22:22:26', '2026-04-23 23:21:00', null);
INSERT INTO `sa_article` VALUES ('10', '2', '切尔西官宣41岁主帅下课！带队107天+英超遭5连败 解约金1200万镑', 'admin', '1', '2', 'http://127.0.0.1:8000/uploads/2026/03/28/69c7a3acd6b581.21163358.png', '切尔西官宣41岁主帅下课！带队107天+英超遭5连败 解约金1200万镑', '<p><br></p><p style=\"text-align: justify;\">北京时间4月23日，英超豪门切尔西俱乐部官方宣布，因近期比赛结果和球队表现未能达到应有标准，41岁的主帅罗塞尼尔正式下课。</p><p style=\"text-align: justify;\">切尔西官方向罗塞尼尔及其教练组，在俱乐部效力期间所付出的所有努力，表示衷心的感谢，并祝愿他在未来一切顺利。</p><p style=\"text-align: center;\"><img src=\"https://nimg.ws.126.net/?url=http%3A%2F%2Fdingyue.ws.126.net%2F2026%2F0423%2Fd77d2db1j00tdwmbr00p7d000qo00gcm.jpg&amp;thumbnail=660x2147483647&amp;quality=80&amp;type=jpg\" alt=\"\" data-href=\"\" style=\"\"><br><br></p><p style=\"text-align: justify;\">切尔西还同时宣布，助教卡勒姆·麦克法兰将担任一线队临时主教练，带领球队直至本赛季结束，并由俱乐部现有教练组成员协助。</p><p style=\"text-align: justify;\">切尔西官方还表示，俱乐部未来会在寻求新帅稳定人选的过程中，进行自我反思，以做出正确的长期任命。</p><p style=\"text-align: center;\"><img src=\"https://nimg.ws.126.net/?url=http%3A%2F%2Fdingyue.ws.126.net%2F2026%2F0423%2Fc5090293j00tdwmbr008dd000qo00g8m.jpg&amp;thumbnail=660x2147483647&amp;quality=80&amp;type=jpg\" alt=\"\" data-href=\"\" style=\"\"><br><br></p><p style=\"text-align: justify;\">今年1月8日，罗塞尼尔从清湖集团旗下的另一支球队斯特拉斯堡，“内部调遣”来到切尔西，双方签下了长达6年半的合同。</p><p style=\"text-align: justify;\">上任之初，他带领切尔西踢出了不错的成绩，前9场比赛球队只在英联杯两负阿森纳，赢下了剩余7场。</p><p style=\"text-align: center;\"><img src=\"https://nimg.ws.126.net/?url=http%3A%2F%2Fdingyue.ws.126.net%2F2026%2F0423%2F52e72206j00tdwmbq0017d000qo00hmm.jpg&amp;thumbnail=660x2147483647&amp;quality=80&amp;type=jpg\" alt=\"\" data-href=\"\" style=\"\"><br><br></p><p style=\"text-align: justify;\">但随后，切尔西的状况开始急转直下，最近8场比赛，切尔西1胜7负，唯一的一胜还是在足总杯赛场战胜第三级别联赛球队维尔港。</p><p style=\"text-align: justify;\">最近5场联赛，切尔西遭遇5连败且一球未进，目前切尔西在本轮先赛的情况下，已经落后欧冠区7分之多。</p><p style=\"text-align: justify;\">最终，罗塞尼尔仅执教切尔西107天后，便黯然下课。他带队打了23场比赛，战绩为11胜2平10负，胜率不到5成。</p><p style=\"text-align: center;\"><img src=\"https://nimg.ws.126.net/?url=http%3A%2F%2Fdingyue.ws.126.net%2F2026%2F0423%2F869822dfj00tdwmbr00bbd000e600hvm.jpg&amp;thumbnail=660x2147483647&amp;quality=80&amp;type=jpg\" alt=\"\" data-href=\"\" style=\"\"><br><br></p><p style=\"text-align: justify;\">而据多家媒体确认，罗塞尼尔在切尔西剩余未被支付的薪水高达2400万镑。而队报记者表示，切尔西不会支付所有剩余款项，将支付1000万-1200万镑解雇他。</p><p style=\"text-align: justify;\"><br></p>', null, null, null, null, '0', '100', '1', '2', '', '2', '1', '1', '2026-04-23 23:39:01', '2026-06-21 19:39:42', null);
INSERT INTO `sa_article` VALUES ('11', '1', 'Dromara Warm-Flow，国产的工作流引擎1', 'Dromara', '1', '1', 'http://127.0.0.1:8000/uploads/2026/03/28/69c7a3af23d945.66099869.webp', 'Dromara Warm-Flow，国产的工作流引擎，以其简洁轻量、五脏俱全、灵活扩展性强的特点，成为了众多开发者的首选。它不仅可以通过jar包快速集成设计器，同时原生支持经典和仿钉钉双模式，还具备以下显著优势：', '<blockquote style=\"text-align: start;\">Dromara Warm-Flow，国产的工作流引擎，以其简洁轻量、五脏俱全、灵活扩展性强的特点，成为了众多开发者的首选。它不仅可以通过jar包快速集成设计器，同时原生支持经典和仿钉钉双模式，还具备以下显著优势：</blockquote><ul><li style=\"text-align: start;\"><strong>简洁易用</strong>‌：仅包含7张表，代码量少，上手和集成速度快。</li><li style=\"text-align: start;\"><strong>审批功能全面</strong>‌：支持通过、退回、撤销、拿回、任意跳转、终止、转办、票签、委派和加减签、互斥、并行、自动审批、远程访问和脚本执行服务等多种审批操作，以及条件表达式、办理人表达和监听器等高级功能。</li><li style=\"text-align: start;\"><strong>流程设计器</strong>‌：通过jar包形式快速集成到项目，支持节点属性扩展，原生支持经典和仿钉钉双模式。</li><li style=\"text-align: start;\"><strong>流程图</strong>‌：自带流程图，通过jar包快速集，功能扩展，原生支持经典和仿钉钉双模式。</li><li style=\"text-align: start;\"><strong>条件表达式</strong>‌：内置常见的和spel条件表达式，支持自定义扩展。</li><li style=\"text-align: start;\"><strong>办理人变量表达式</strong>‌：内置${handler}和spel格式的表达式，满足不同场景需求，灵活可扩展。</li><li style=\"text-align: start;\"><strong>监听器</strong>‌：提供四种监听器，支持不同作用范围和spel表达式，参数传递灵活，支持动态权限。</li><li style=\"text-align: start;\"><strong>流程变量</strong>‌：在整个流程办理过程起到重要的角色，如办理人表达式中，传入变量进行动态指定办理人。</li><li style=\"text-align: start;\"><strong>ORM框架支持</strong>‌：支持MyBatis、Mybatis-Plus、Mybatis-Flex、Jpa、Easy-Query和BeetlSql，后续将扩展支持其他框架</li><li style=\"text-align: start;\"><strong>数据库支持</strong>‌：支持MySQL、Oracle、PostgreSQL和SQL Server，其他数据库只需要转换表结构即可支持。</li><li style=\"text-align: start;\"><strong>多租户与软删除</strong>‌：流程引擎自身维护多租户和软删除实现，也可使用对应ORM框架的实现方式。</li><li style=\"text-align: start;\"><strong>兼容性</strong>‌：同时支持Spring和Solon，兼容Java8、Java17、Java21。</li><li style=\"text-align: start;\"><strong>实战项目</strong>‌：官方提供基于Ruoyi-Vue封装的实战项目，极具参考价值。</li><li style=\"text-align: start;\"></li><li style=\"text-align: start;\"> <a href=\"https://www.warm-flow.com/master/introduction/introduction.html\" target=\"_blank\">https://www.warm-flow.com/master/introduction/introduction.html</a> </li><li style=\"text-align: start;\"> <a href=\"https://juejin.cn/post/7205873584339009596\" target=\"_blank\">https://juejin.cn/post/7205873584339009596</a> </li></ul>', null, null, null, null, '0', '100', '1', '2', '', '2', '1', '1', '2026-04-26 17:09:16', '2026-06-23 18:42:25', null);

-- ----------------------------
-- Table structure for `sa_article_banner`
-- ----------------------------
DROP TABLE IF EXISTS `sa_article_banner`;
CREATE TABLE `sa_article_banner` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '编号',
  `banner_type` int(11) DEFAULT NULL COMMENT '类型',
  `image` varchar(1000) DEFAULT NULL COMMENT '图片地址',
  `is_href` tinyint(1) DEFAULT '1' COMMENT '是否链接',
  `url` varchar(255) DEFAULT NULL COMMENT '链接地址',
  `title` varchar(255) DEFAULT NULL COMMENT '标题',
  `status` tinyint(1) DEFAULT '1' COMMENT '状态',
  `sort` int(11) DEFAULT '0' COMMENT '排序',
  `remark` varchar(255) DEFAULT NULL COMMENT '描述',
  `created_by` int(11) DEFAULT NULL COMMENT '创建者',
  `updated_by` int(11) DEFAULT NULL COMMENT '更新者',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='文章轮播图';

-- ----------------------------
-- Records of sa_article_banner
-- ----------------------------
INSERT INTO `sa_article_banner` VALUES ('1', '1', 'https://picsum.photos/id/490/640/360', '1', '/blog/1', '探索亚洲的烹饪奇迹', '1', '100', '有一系列名为“新加坡传统烹饪”的食谱，探索了新加坡的美食和文化。它包括新加坡华人、马来人、印度人、欧亚人和土生华人（海峡华人）的美食', '1', '1', '2024-06-02 23:06:37', '2026-01-09 21:51:50', null);
INSERT INTO `sa_article_banner` VALUES ('2', '1', 'https://picsum.photos/id/29/640/360', '1', '/blog/2', '探索雄伟的山峰', '1', '100', '攀登这座风景如画的山峰的最佳方式是乘坐御在所索道，乘坐15 分钟即可将游客带入空中，欣赏周围一览无余的景观', '1', '1', '2024-06-02 23:06:49', '2026-01-09 21:51:54', null);
INSERT INTO `sa_article_banner` VALUES ('3', '1', 'https://picsum.photos/id/903/640/360', '1', '/blog/3', '揭秘奇迹', '1', '100', '极光是地球磁场与太阳风相互作用的产物，当太阳风中的带电粒子与地球高层大气中的原子、分子碰撞时，会产生发光现象，形成美丽的极光', '1', '1', '2024-06-02 23:06:56', '2026-01-09 21:53:32', null);

-- ----------------------------
-- Table structure for `sa_article_category`
-- ----------------------------
DROP TABLE IF EXISTS `sa_article_category`;
CREATE TABLE `sa_article_category` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '编号',
  `parent_id` int(11) NOT NULL DEFAULT '0' COMMENT '父级ID',
  `category_name` varchar(255) NOT NULL COMMENT '分类标题',
  `describe` varchar(255) DEFAULT NULL COMMENT '分类简介',
  `image` varchar(255) DEFAULT NULL COMMENT '分类图片',
  `sort` int(10) unsigned DEFAULT '100' COMMENT '排序',
  `status` tinyint(1) unsigned DEFAULT '1' COMMENT '状态',
  `created_by` int(11) DEFAULT NULL COMMENT '创建者',
  `updated_by` int(11) DEFAULT NULL COMMENT '更新者',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='文章分类表';

-- ----------------------------
-- Records of sa_article_category
-- ----------------------------
INSERT INTO `sa_article_category` VALUES ('1', '0', '大国科技', '', null, '100', '1', '1', '1', '2024-06-02 22:50:51', '2026-01-06 18:03:07', null);
INSERT INTO `sa_article_category` VALUES ('2', '0', '数字经济', '', null, '100', '1', '1', '1', '2024-06-02 22:50:56', '2026-01-09 16:54:05', null);
INSERT INTO `sa_article_category` VALUES ('3', '0', '科技快讯', '', null, '100', '1', '1', '1', '2024-06-02 22:51:01', '2026-01-07 01:03:37', null);
INSERT INTO `sa_article_category` VALUES ('4', '0', '低空经济', '', null, '100', '1', '1', '1', '2024-06-02 22:51:16', '2026-01-06 18:03:14', null);

-- ----------------------------
-- Table structure for `sa_job`
-- ----------------------------
DROP TABLE IF EXISTS `sa_job`;
CREATE TABLE `sa_job` (
  `job_id` int(11) NOT NULL AUTO_INCREMENT COMMENT '任务ID',
  `job_name` varchar(64) NOT NULL COMMENT '任务名称',
  `job_group` varchar(64) NOT NULL DEFAULT 'DEFAULT' COMMENT '任务组名',
  `invoke_target` varchar(500) NOT NULL COMMENT '调用目标字符串',
  `cron_expression` varchar(255) DEFAULT NULL COMMENT 'cron执行表达式',
  `misfire_policy` varchar(20) DEFAULT '3' COMMENT '计划执行错误策略（1立即执行 2执行一次 3放弃执行）',
  `concurrent` char(1) DEFAULT '1' COMMENT '是否并发执行（0允许 1禁止）',
  `status` char(1) NOT NULL DEFAULT '0' COMMENT '状态',
  `create_by` varchar(64) NOT NULL DEFAULT '' COMMENT '创建者',
  `create_time` datetime(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `update_by` varchar(64) NOT NULL DEFAULT '' COMMENT '更新者',
  `update_time` datetime(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `del_flag` char(1) NOT NULL DEFAULT '0' COMMENT '删除标志',
  PRIMARY KEY (`job_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COMMENT='定时任务表';

-- ----------------------------
-- Records of sa_job
-- ----------------------------
INSERT INTO `sa_job` VALUES ('1', '系统默认（无参）', 'DEFAULT', 'task.noParams', '0 0 0 * * 1', '3', '1', '1', 'admin', '2025-02-28 16:52:10.000000', 'admin', '2026-06-19 00:32:16.000000', '', '0');
INSERT INTO `sa_job` VALUES ('2', '系统默认（有参）', 'DEFAULT', 'task.params(\'ry\')', '0 0 0 * * 1', '3', '1', '1', 'admin', '2025-02-28 16:52:10.000000', '', '2026-06-19 09:53:40.000000', '', '0');
INSERT INTO `sa_job` VALUES ('3', '系统默认（多参）', 'DEFAULT', 'task.multipleParams(\'ry\', true, 2000L, 316.50D, 100)', '0/20 * * * * ?', '3', '1', '1', 'admin', '2025-02-28 16:52:10.000000', '', null, '', '0');
INSERT INTO `sa_job` VALUES ('4', 'ceshi', 'DEFAULT', 'task.backupDatabase()', '0 1 1 * * *', '3', '0', '0', '', '2026-06-23 23:31:31.433830', '', '2026-06-23 23:31:31.433830', '', '0');

-- ----------------------------
-- Table structure for `sa_job_log`
-- ----------------------------
DROP TABLE IF EXISTS `sa_job_log`;
CREATE TABLE `sa_job_log` (
  `job_log_id` int(11) NOT NULL AUTO_INCREMENT COMMENT '任务日志ID',
  `job_name` varchar(64) NOT NULL COMMENT '任务名称',
  `job_group` varchar(64) NOT NULL COMMENT '任务组名',
  `invoke_target` varchar(500) NOT NULL COMMENT '调用目标字符串',
  `job_message` varchar(500) DEFAULT NULL COMMENT '日志信息',
  `status` char(1) NOT NULL DEFAULT '0' COMMENT '执行状态（0正常 1失败）',
  `exception_info` varchar(2000) DEFAULT NULL COMMENT '异常信息',
  `create_time` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  PRIMARY KEY (`job_log_id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COMMENT='任务调度日志表';

-- ----------------------------
-- Records of sa_job_log
-- ----------------------------

-- ----------------------------
-- Table structure for `sa_system_attachment`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_attachment`;
CREATE TABLE `sa_system_attachment` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `category_id` int(11) DEFAULT '0' COMMENT '文件分类',
  `storage_mode` smallint(6) DEFAULT '1' COMMENT '存储模式 (1 本地 2 阿里云 3 七牛云 4 腾讯云)',
  `origin_name` varchar(255) DEFAULT NULL COMMENT '原文件名',
  `object_name` varchar(255) NOT NULL COMMENT '存储对象名',
  `hash` varchar(64) DEFAULT NULL COMMENT '文件hash',
  `mime_type` varchar(255) DEFAULT NULL COMMENT '资源类型',
  `storage_path` varchar(512) NOT NULL COMMENT '存储路径',
  `suffix` varchar(10) DEFAULT NULL COMMENT '文件后缀',
  `size_byte` bigint(20) DEFAULT NULL COMMENT '字节数',
  `size_info` varchar(50) DEFAULT NULL COMMENT '文件大小',
  `url` varchar(1024) NOT NULL COMMENT '文件地址',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` int(11) DEFAULT NULL COMMENT '创建者',
  `updated_by` int(11) DEFAULT NULL COMMENT '更新者',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='文件上传记录';

-- ----------------------------
-- Records of sa_system_attachment
-- ----------------------------

-- ----------------------------
-- Table structure for `sa_system_category`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_category`;
CREATE TABLE `sa_system_category` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '分类ID',
  `parent_id` int(11) NOT NULL DEFAULT '0' COMMENT '父id',
  `level` varchar(255) DEFAULT NULL COMMENT '组集关系',
  `category_name` varchar(100) NOT NULL DEFAULT '' COMMENT '分类名称',
  `sort` int(11) NOT NULL DEFAULT '0' COMMENT '排序',
  `status` tinyint(1) DEFAULT '1' COMMENT '状态',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` int(11) DEFAULT NULL COMMENT '创建者',
  `updated_by` int(11) DEFAULT NULL COMMENT '更新者',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `pid` (`parent_id`) USING BTREE,
  KEY `sort` (`sort`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='附件分类表';

-- ----------------------------
-- Records of sa_system_category
-- ----------------------------
INSERT INTO `sa_system_category` VALUES ('1', '0', '0,', '全部分类', '100', '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_category` VALUES ('2', '1', '0,1,', '图片分类', '100', '1', null, '1', '1', '2026-01-01 00:00:00', '2026-04-21 01:04:51', null);
INSERT INTO `sa_system_category` VALUES ('3', '1', '0,1,', '文件分类', '100', '1', null, '1', '1', '2026-01-01 00:00:00', '2026-03-23 21:54:20', null);
INSERT INTO `sa_system_category` VALUES ('4', '1', '0,1,', '系统图片', '100', '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_category` VALUES ('5', '1', '0,1,', '其他分类', '100', '1', null, '1', '1', '2026-01-01 00:00:00', '2026-03-28 23:51:54', null);
INSERT INTO `sa_system_category` VALUES ('6', '1', '0,1,', 'ces', '100', '1', '', '1', '1', '2026-03-23 21:52:33', '2026-03-23 21:52:35', '2026-03-23 21:52:35');
INSERT INTO `sa_system_category` VALUES ('7', '2', '0,1,2,', '测试', '100', '1', '', '1', '1', '2026-03-23 21:52:46', '2026-03-23 22:02:52', '2026-03-23 22:02:52');

-- ----------------------------
-- Table structure for `sa_system_config`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_config`;
CREATE TABLE `sa_system_config` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '编号',
  `group_id` int(11) DEFAULT NULL COMMENT '组id',
  `key` varchar(32) NOT NULL COMMENT '配置键名',
  `value` text COMMENT '配置值',
  `name` varchar(255) DEFAULT NULL COMMENT '配置名称',
  `input_type` varchar(32) DEFAULT NULL COMMENT '数据输入类型',
  `config_select_data` varchar(500) DEFAULT NULL COMMENT '配置选项数据',
  `sort` smallint(5) unsigned DEFAULT '0' COMMENT '排序',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` int(11) DEFAULT NULL COMMENT '创建人',
  `updated_by` int(11) DEFAULT NULL COMMENT '更新人',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`,`key`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=71 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='参数配置表';

-- ----------------------------
-- Records of sa_system_config
-- ----------------------------
INSERT INTO `sa_system_config` VALUES ('1', '1', 'site_copyright', 'Copyright © 2026 FSSPHP Team', '版权信息', 'textarea', null, '96', '', '1', '1', '2026-01-01 00:00:00', '2026-03-22 20:34:45', null);
INSERT INTO `sa_system_config` VALUES ('2', '1', 'site_desc', '基于Vue3 + FSSPHP 的极速开发框架', '网站描述', 'textarea', null, '97', null, '1', '1', '2026-01-01 00:00:00', '2026-04-23 21:36:30', null);
INSERT INTO `sa_system_config` VALUES ('3', '1', 'site_keywords', 'FSSPHP, Workerman，symfony，Thinkphp，后台管理系统', '网站关键字', 'input', null, '98', null, '1', '1', '2026-01-01 00:00:00', '2026-04-23 21:36:23', null);
INSERT INTO `sa_system_config` VALUES ('4', '1', 'site_name', 'FssAdmin后台管理系统', '网站名称', 'input', null, '99', null, '1', '1', '2026-01-01 00:00:00', '2026-04-23 21:36:24', null);
INSERT INTO `sa_system_config` VALUES ('5', '1', 'site_record_number', '9527', '网站备案号', 'input', null, '95', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('6', '2', 'upload_allow_file', 'txt,doc,docx,xls,xlsx,ppt,pptx,rar,zip,7z,gz,pdf,wps,md,jpg,png,jpeg,mp4,pem,crt', '文件类型', 'input', null, '0', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('7', '2', 'upload_allow_image', 'jpg,jpeg,png,gif,svg,bmp', '图片类型', 'input', null, '0', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('8', '2', 'upload_mode', '1', '上传模式', 'select', '[{\"label\":\"本地上传\",\"value\":\"1\"},{\"label\":\"阿里云OSS\",\"value\":\"2\"},{\"label\":\"七牛云\",\"value\":\"3\"},{\"label\":\"腾讯云COS\",\"value\":\"4\"},{\"label\":\"亚马逊S3\",\"value\":\"5\"}]', '99', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('10', '2', 'upload_size', '52428800', '上传大小', 'input', null, '88', '单位Byte,1MB=1024*1024Byte', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('11', '2', 'local_root', 'public/storage/', '本地存储路径', 'input', null, '0', '本地存储文件路径', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('12', '2', 'local_domain', 'http://127.0.0.1:8000', '本地存储域名', 'input', null, '0', 'http://127.0.0.1:8787', '1', '1', '2026-01-01 00:00:00', '2026-03-22 20:07:02', null);
INSERT INTO `sa_system_config` VALUES ('13', '2', 'local_uri', '/storage/', '本地访问路径', 'input', null, '0', '访问是通过domain + uri', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('14', '2', 'qiniu_accessKey', '', '七牛key', 'input', null, '0', '七牛云存储secretId', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('15', '2', 'qiniu_secretKey', '', '七牛secret', 'input', null, '0', '七牛云存储secretKey', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('16', '2', 'qiniu_bucket', '', '七牛bucket', 'input', null, '0', '七牛云存储bucket', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('17', '2', 'qiniu_dirname', '', '七牛dirname', 'input', null, '0', '七牛云存储dirname', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('18', '2', 'qiniu_domain', '', '七牛domain', 'input', null, '0', '七牛云存储domain', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('19', '2', 'cos_secretId', '', '腾讯Id', 'input', null, '0', '腾讯云存储secretId', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('20', '2', 'cos_secretKey', '', '腾讯key', 'input', null, '0', '腾讯云secretKey', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('21', '2', 'cos_bucket', '', '腾讯bucket', 'input', null, '0', '腾讯云存储bucket', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('22', '2', 'cos_dirname', '', '腾讯dirname', 'input', null, '0', '腾讯云存储dirname', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('23', '2', 'cos_domain', '', '腾讯domain', 'input', null, '0', '腾讯云存储domain', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('24', '2', 'cos_region', '', '腾讯region', 'input', null, '0', '腾讯云存储region', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('25', '2', 'oss_accessKeyId', '', '阿里Id', 'input', null, '0', '阿里云存储accessKeyId', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('26', '2', 'oss_accessKeySecret', '', '阿里Secret', 'input', null, '0', '阿里云存储accessKeySecret', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('27', '2', 'oss_bucket', '', '阿里bucket', 'input', null, '0', '阿里云存储bucket', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('28', '2', 'oss_dirname', '', '阿里dirname', 'input', null, '0', '阿里云存储dirname', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('29', '2', 'oss_domain', '', '阿里domain', 'input', null, '0', '阿里云存储domain', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('30', '2', 'oss_endpoint', '', '阿里endpoint', 'input', null, '0', '阿里云存储endpoint', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('31', '3', 'Host', 'smtp.qq.com', 'SMTP服务器', 'input', '', '100', '', '1', '1', '2026-01-01 00:00:00', '2026-06-23 17:56:52', null);
INSERT INTO `sa_system_config` VALUES ('32', '3', 'Port', '465', 'SMTP端口', 'input', '', '100', '', '1', '1', '2026-01-01 00:00:00', '2026-06-23 17:56:52', null);
INSERT INTO `sa_system_config` VALUES ('33', '3', 'Username', '', 'SMTP用户名', 'input', '', '100', '', '1', '1', '2026-01-01 00:00:00', '2026-06-23 17:56:52', null);
INSERT INTO `sa_system_config` VALUES ('34', '3', 'Password', '', 'SMTP密码', 'input', '', '100', '', '1', '1', '2026-01-01 00:00:00', '2026-06-23 17:56:52', null);
INSERT INTO `sa_system_config` VALUES ('35', '3', 'SMTPSecure', 'ssl', 'SMTP验证方式', 'radio', '[\r\n    {\"label\":\"ssl\",\"value\":\"ssl\"},\r\n    {\"label\":\"tsl\",\"value\":\"tsl\"}\r\n]', '100', '', '1', '1', '2026-01-01 00:00:00', '2026-06-23 17:56:52', null);
INSERT INTO `sa_system_config` VALUES ('36', '3', 'From', '', '默认发件人', 'input', '', '100', '默认发件的邮箱地址', '1', '1', '2026-01-01 00:00:00', '2026-06-23 17:56:52', null);
INSERT INTO `sa_system_config` VALUES ('37', '3', 'FromName', '账户注册', '默认发件名称', 'input', '', '100', '', '1', '1', '2026-01-01 00:00:00', '2026-06-23 17:56:52', null);
INSERT INTO `sa_system_config` VALUES ('38', '3', 'CharSet', 'UTF-8', '编码', 'input', '', '100', '', '1', '1', '2026-01-01 00:00:00', '2026-06-23 17:56:52', null);
INSERT INTO `sa_system_config` VALUES ('39', '3', 'SMTPDebug', '1', '调试模式', 'radio', '[\r\n    {\"label\":\"关闭\",\"value\":\"0\"},\r\n    {\"label\":\"client\",\"value\":\"1\"},\r\n    {\"label\":\"server\",\"value\":\"2\"}\r\n]', '100', '', '1', '1', '2026-01-01 00:00:00', '2026-06-23 17:56:52', null);
INSERT INTO `sa_system_config` VALUES ('40', '2', 's3_key', '', 'key', 'input', '', '0', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('41', '2', 's3_secret', '', 'secret', 'input', '', '0', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('42', '2', 's3_bucket', '', 'bucket', 'input', '', '0', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('43', '2', 's3_dirname', '', 'dirname', 'input', '', '0', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('44', '2', 's3_domain', '', 'domain', 'input', '', '0', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('45', '2', 's3_region', '', 'region', 'input', '', '0', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('46', '2', 's3_version', '', 'version', 'input', '', '0', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('47', '2', 's3_use_path_style_endpoint', '', 'path_style_endpoint', 'input', '', '0', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('48', '2', 's3_endpoint', '', 'endpoint', 'input', '', '0', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('49', '2', 's3_acl', '', 'acl', 'input', '', '0', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config` VALUES ('50', '1', 'ggg', '', 'ggg', 'uploadImage', null, '100', '', '1', '1', '2026-03-22 20:11:57', '2026-03-22 20:36:34', '2026-03-22 20:36:34');
INSERT INTO `sa_system_config` VALUES ('52', '1', 'Logo', 'http://127.0.0.1:8000/uploads/2026/03/28/69c7a3acd6b581.21163358.png', 'Logo', 'uploadImage', null, '100', '', '1', '1', '2026-03-25 21:30:52', '2026-03-28 23:36:48', '2026-03-28 23:36:48');
INSERT INTO `sa_system_config` VALUES ('54', '1', 'file', '', 'file', 'uploadFile', '[]', '100', '', '1', '1', '2026-03-28 22:17:22', '2026-03-28 22:17:32', '2026-03-28 22:17:32');
INSERT INTO `sa_system_config` VALUES ('55', '1', 'file', '', 'file', 'uploadFile', '[]', '100', '', '1', '1', '2026-03-28 22:17:23', '2026-03-28 22:17:36', '2026-03-28 22:17:36');
INSERT INTO `sa_system_config` VALUES ('56', '1', 'file', '', 'file', 'uploadFile', '[]', '100', '', '1', '1', '2026-03-28 22:17:28', '2026-03-28 23:36:48', '2026-03-28 23:36:48');
INSERT INTO `sa_system_config` VALUES ('60', '10', 'ai_enabled', '1', '启用 AI 助手', 'select', '[{\"label\":\"关闭\",\"value\":\"0\"},{\"label\":\"开启\",\"value\":\"1\"}]', '100', '', '1', '1', '2026-06-21 22:51:58', '2026-06-21 22:51:58', null);
INSERT INTO `sa_system_config` VALUES ('61', '10', 'ai_max_history_rounds', '10', '默认携带历史轮数', 'input', null, '90', '构建上下文时最多取最近 N 轮；配合摘要可设 8-12', '1', '1', '2026-06-21 22:51:58', '2026-06-21 22:51:58', null);
INSERT INTO `sa_system_config` VALUES ('62', '10', 'ai_summary_enabled', '1', '启用长对话自动摘要', 'select', '[{\"label\":\"关闭\",\"value\":\"0\"},{\"label\":\"开启\",\"value\":\"1\"}]', '89', '超出触发轮数后压缩旧消息为摘要', '1', '1', '2026-06-21 22:51:58', '2026-06-21 22:51:58', null);
INSERT INTO `sa_system_config` VALUES ('63', '10', 'ai_summary_trigger_rounds', '12', '摘要触发轮数', 'input', null, '88', '对话超过 N 轮后开始摘要旧消息', '1', '1', '2026-06-21 22:51:58', '2026-06-21 22:51:58', null);
INSERT INTO `sa_system_config` VALUES ('64', '10', 'ai_summary_keep_rounds', '8', '摘要后保留原文轮数', 'input', null, '87', '最近 N 轮仍以完整消息发送', '1', '1', '2026-06-21 22:51:58', '2026-06-21 22:51:58', null);
INSERT INTO `sa_system_config` VALUES ('65', '10', 'ai_context_reserve_tokens', '1024', '上下文安全余量(tokens)', 'input', null, '86', '预留给输出与格式开销，防止超窗', '1', '1', '2026-06-21 22:51:58', '2026-06-21 22:51:58', null);
INSERT INTO `sa_system_config` VALUES ('66', '10', 'ai_summary_model_id', '', '摘要专用模型ID', 'input', null, '85', '留空则用会话当前模型；可填便宜模型 ID 省 token', '1', '1', '2026-06-21 22:51:58', '2026-06-21 22:51:58', null);
INSERT INTO `sa_system_config` VALUES ('67', '10', 'ai_ws_heartbeat_sec', '30', 'WebSocket 心跳间隔(秒)', 'input', null, '80', '', '1', '1', '2026-06-21 22:51:58', '2026-06-21 22:51:58', null);
INSERT INTO `sa_system_config` VALUES ('68', '10', 'ai_message_max_tokens', '1500', '单条历史消息上限(tokens)', 'input', null, '84', 'Reasonix 式 turn-end 截断，完整内容仍存 DB', '1', '1', '2026-06-21 23:03:39', '2026-06-21 23:03:39', null);
INSERT INTO `sa_system_config` VALUES ('69', '10', 'ai_context_compact_threshold', '80', '紧急压缩阈值(%)', 'input', null, '83', '上下文占比达此值触发摘要，对标 Reasonix 80%', '1', '1', '2026-06-21 23:03:39', '2026-06-21 23:03:39', null);
INSERT INTO `sa_system_config` VALUES ('70', '10', 'ai_context_compact_proactive', '40', '主动压缩阈值(%)', 'input', null, '82', '上下文占比达此值提前摘要，对标 Reasonix 40%', '1', '1', '2026-06-21 23:03:39', '2026-06-21 23:03:39', null);

-- ----------------------------
-- Table structure for `sa_system_config_group`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_config_group`;
CREATE TABLE `sa_system_config_group` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name` varchar(50) DEFAULT NULL COMMENT '字典名称',
  `code` varchar(100) DEFAULT NULL COMMENT '字典标示',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` int(11) DEFAULT NULL COMMENT '创建人',
  `updated_by` int(11) DEFAULT NULL COMMENT '更新人',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='参数配置分组表';

-- ----------------------------
-- Records of sa_system_config_group
-- ----------------------------
INSERT INTO `sa_system_config_group` VALUES ('1', '站点配置', 'site_config', '111', '1', '1', '2026-01-01 00:00:00', '2026-03-31 00:31:21', null);
INSERT INTO `sa_system_config_group` VALUES ('2', '上传配置', 'upload_config', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config_group` VALUES ('3', '邮件服务', 'email_config', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_config_group` VALUES ('10', 'AI 助手', 'ai', '大模型对话全局参数', '1', '1', '2026-06-21 21:59:30', '2026-06-21 21:59:30', null);

-- ----------------------------
-- Table structure for `sa_system_dept`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_dept`;
CREATE TABLE `sa_system_dept` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `parent_id` bigint(20) unsigned DEFAULT '0' COMMENT '父级ID，0为根节点',
  `name` varchar(64) NOT NULL COMMENT '部门名称',
  `code` varchar(64) DEFAULT NULL COMMENT '部门编码',
  `leader_id` bigint(20) unsigned DEFAULT NULL COMMENT '部门负责人ID',
  `level` varchar(255) DEFAULT '' COMMENT '祖级列表，格式: 0,1,5, (便于查询子孙节点)',
  `tenant_id` bigint(20) unsigned NOT NULL DEFAULT '0' COMMENT '所属租户ID，0表示系统级',
  `sort` int(11) DEFAULT '0' COMMENT '排序，数字越小越靠前',
  `status` tinyint(1) DEFAULT '1' COMMENT '状态: 1启用, 0禁用',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` int(11) DEFAULT NULL COMMENT '创建者',
  `updated_by` int(11) DEFAULT NULL COMMENT '更新者',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=131 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='部门表';

-- ----------------------------
-- Records of sa_system_dept
-- ----------------------------
INSERT INTO `sa_system_dept` VALUES ('1', '0', '腾讯集团', 'GROUP', '100', '0,', '1', '0', '1', '00', '1', '1', '2026-01-01 00:00:00', '2026-06-23 21:04:07', null);
INSERT INTO `sa_system_dept` VALUES ('2', '0', '总办', 'GMO', '0', '0,1,', '1', '1', '1', null, '1', '1', '2026-01-01 00:00:00', '2026-03-22 11:20:13', null);
INSERT INTO `sa_system_dept` VALUES ('5', '0', '技术部A', null, null, '', '1', '0', '1', null, null, null, '2026-04-24 12:34:04', '2026-04-24 12:34:04', null);
INSERT INTO `sa_system_dept` VALUES ('8', '0', '销售部B', null, null, '', '2', '0', '1', null, null, null, '2026-04-24 12:34:04', '2026-04-24 12:34:04', null);
INSERT INTO `sa_system_dept` VALUES ('10', '0', '微信事业群', 'WXG', '0', '0,1,', '1', '1', '1', null, '1', '1', '2026-01-01 00:00:00', '2026-03-22 11:38:29', null);
INSERT INTO `sa_system_dept` VALUES ('11', '0', '互动娱乐事业群', 'IEG', '0', '0,1,', '1', '1', '1', null, '1', '1', '2026-01-01 00:00:00', '2026-03-22 11:39:34', null);
INSERT INTO `sa_system_dept` VALUES ('12', '1', '云与智慧产业事业群', 'CSIG', '10', '0,1,', '1', '400', '1', '122', '1', '1', '2026-01-01 00:00:00', '2026-06-23 18:41:24', null);
INSERT INTO `sa_system_dept` VALUES ('100', '0', '测试部门', null, null, '', '10', '0', '1', null, null, null, '2026-04-24 12:40:17', '2026-04-24 12:40:17', null);
INSERT INTO `sa_system_dept` VALUES ('101', '10', '微信基础产品部', 'WX_BASE', null, '0,1,10,', '1', '100', '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dept` VALUES ('102', '10', '微信支付线', 'WX_PAY', null, '0,1,10,', '1', '200', '1', null, '1', '1', '2026-01-01 00:00:00', '2026-03-22 11:37:14', null);
INSERT INTO `sa_system_dept` VALUES ('110', '0', '父部门', null, null, '', '10', '0', '1', null, null, null, '2026-04-24 12:40:19', '2026-04-24 12:40:19', null);
INSERT INTO `sa_system_dept` VALUES ('111', '11', '天美工作室群', 'TIMI', null, '0,1,11,', '1', '100', '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dept` VALUES ('112', '11', '光子工作室群', 'LIGHT', null, '0,1,11,', '1', '200', '1', null, '1', '1', '2026-01-01 00:00:00', '2026-03-22 22:00:41', null);
INSERT INTO `sa_system_dept` VALUES ('120', '0', '权限测试部门', null, null, '', '10', '0', '1', null, null, null, '2026-04-24 12:40:19', '2026-04-24 12:40:19', null);
INSERT INTO `sa_system_dept` VALUES ('121', '12', '腾讯云事业部1', 'CLOUD', '5', '0,1,12,', '1', '100', '1', '111', '1', '1', '2026-01-01 00:00:00', '2026-03-22 22:44:34', null);
INSERT INTO `sa_system_dept` VALUES ('122', '111', '王者荣耀项目组', 'HOK', '101', '0,1,11,111,', '1', '100', '1', null, '1', '1', '2026-01-01 00:00:00', '2026-03-22 13:01:35', null);
INSERT INTO `sa_system_dept` VALUES ('123', '111', 'QQ飞车项目组', 'QQ_SPEED', '5', '0,1,11,111,', '0', '200', '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dept` VALUES ('127', '0', '111233', '11111', '100', '0,', '1', '100', '1', '11', '1', '1', '2026-03-22 12:06:27', '2026-03-31 19:30:50', '2026-03-31 19:30:50');
INSERT INTO `sa_system_dept` VALUES ('128', '0', '11', '111', '10', '0,', '0', '100', '1', '', '1', '1', '2026-03-22 12:27:44', '2026-03-22 12:48:51', null);
INSERT INTO `sa_system_dept` VALUES ('129', '0', '5555', 'aa', '0', '0,', '2', '100', '1', '', '100', '10', '2026-04-19 00:30:03', '2026-04-25 11:46:18', null);
INSERT INTO `sa_system_dept` VALUES ('130', '1', '', null, null, '0,1,', '1', '1', '1', null, '1', '1', '2026-06-21 21:33:14', '2026-06-23 17:54:34', '2026-06-23 17:54:34');

-- ----------------------------
-- Table structure for `sa_system_dict_data`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_dict_data`;
CREATE TABLE `sa_system_dict_data` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `type_id` int(11) unsigned DEFAULT NULL COMMENT '字典类型ID',
  `label` varchar(50) DEFAULT NULL COMMENT '字典标签',
  `value` varchar(100) DEFAULT NULL COMMENT '字典值',
  `color` varchar(50) DEFAULT NULL COMMENT '字典颜色',
  `code` varchar(100) DEFAULT NULL COMMENT '字典标示',
  `sort` smallint(5) unsigned DEFAULT '0' COMMENT '排序',
  `status` smallint(6) DEFAULT '1' COMMENT '状态 (1正常 2停用)',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` int(11) DEFAULT NULL COMMENT '创建者',
  `updated_by` int(11) DEFAULT NULL COMMENT '更新者',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=53 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='字典数据表';

-- ----------------------------
-- Records of sa_system_dict_data
-- ----------------------------
INSERT INTO `sa_system_dict_data` VALUES ('2', '2', '本地存储', '1', '#60c041', 'upload_mode', '100', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-03-23 23:00:39', null);
INSERT INTO `sa_system_dict_data` VALUES ('3', '2', '阿里云OSS', '2', '#f9901f', 'upload_mode', '98', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dict_data` VALUES ('4', '2', '七牛云', '3', '#00ced1', 'upload_mode', '97', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dict_data` VALUES ('5', '2', '腾讯云COS', '4', '#1d84ff', 'upload_mode', '96', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dict_data` VALUES ('6', '2', '亚马逊S3', '5', '#b48df3', 'upload_mode', '95', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-03-23 21:19:51', null);
INSERT INTO `sa_system_dict_data` VALUES ('7', '3', '正常', '1', '#60c041', 'data_status', '0', '1', '1为正常', '1', '1', '2026-01-01 00:00:00', '2026-03-24 23:16:13', null);
INSERT INTO `sa_system_dict_data` VALUES ('8', '3', '停用', '0', '#ff4d4f', 'data_status', '0', '1', '0为停用1', '1', '1', '2026-01-01 00:00:00', '2026-03-28 17:53:02', null);
INSERT INTO `sa_system_dict_data` VALUES ('9', '4', '统计页面', 'statistics', '#00ced1', 'dashboard', '100', '1', '管理员用', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dict_data` VALUES ('10', '4', '工作台', 'work', '#ff8c00', 'dashboard', '50', '1', '员工使用', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dict_data` VALUES ('11', '5', '男', '1', '#5d87ff', 'gender', '0', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dict_data` VALUES ('12', '5', '女', '2', '#ff4500', 'gender', '0', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dict_data` VALUES ('13', '5', '未知', '3', '#b48df3', 'gender', '0', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dict_data` VALUES ('16', '12', '图片', 'image', '#60c041', 'attachment_type', '10', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dict_data` VALUES ('17', '12', '文档', 'text', '#1d84ff', 'attachment_type', '9', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dict_data` VALUES ('18', '12', '音频', 'audio', '#00ced1', 'attachment_type', '8', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dict_data` VALUES ('19', '12', '视频', 'video', '#ff4500', 'attachment_type', '7', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dict_data` VALUES ('20', '12', '应用程序', 'application', '#ff8c00', 'attachment_type', '6', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dict_data` VALUES ('21', '13', '目录', '1', '#909399', 'menu_type', '100', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dict_data` VALUES ('22', '13', '菜单', '2', '#1e90ff', 'menu_type', '100', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dict_data` VALUES ('23', '13', '按钮', '3', '#ff4500', 'menu_type', '100', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dict_data` VALUES ('24', '13', '外链', '4', '#00ced1', 'menu_type', '100', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dict_data` VALUES ('25', '14', '是', '1', '#60c041', 'yes_or_no', '100', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dict_data` VALUES ('26', '14', '否', '0', '#ff4500', 'yes_or_no', '100', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-03-23 21:16:53', null);
INSERT INTO `sa_system_dict_data` VALUES ('47', '20', 'URL任务GET', '1', '#5d87ff', 'crontab_task_type', '100', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dict_data` VALUES ('48', '20', 'URL任务POST', '2', '#00ced1', 'crontab_task_type', '100', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-03-28 23:11:23', null);
INSERT INTO `sa_system_dict_data` VALUES ('49', '20', '类任务', '3', '#ff8c00', 'crontab_task_type', '100', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dict_data` VALUES ('50', '5', 'renn', '4', '#5d87ff', null, '100', '1', '', '1', '1', '2026-03-23 21:20:40', '2026-03-23 21:20:44', '2026-03-23 21:20:44');
INSERT INTO `sa_system_dict_data` VALUES ('51', '5', '11', '111', '#5d87ff', null, '100', '0', '', '1', '1', '2026-03-23 21:20:49', '2026-03-23 21:24:19', '2026-03-23 21:24:19');
INSERT INTO `sa_system_dict_data` VALUES ('52', '5', '11', '123', '#5d87ff', null, '100', '1', '', '1', '1', '2026-03-23 21:24:27', '2026-03-23 21:24:30', '2026-03-23 21:24:30');

-- ----------------------------
-- Table structure for `sa_system_dict_type`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_dict_type`;
CREATE TABLE `sa_system_dict_type` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name` varchar(50) DEFAULT NULL COMMENT '字典名称',
  `code` varchar(100) DEFAULT NULL COMMENT '字典标示',
  `status` smallint(6) DEFAULT '1' COMMENT '状态 (1正常 2停用)',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` int(11) DEFAULT NULL COMMENT '创建者',
  `updated_by` int(11) DEFAULT NULL COMMENT '更新者',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='字典类型表';

-- ----------------------------
-- Records of sa_system_dict_type
-- ----------------------------
INSERT INTO `sa_system_dict_type` VALUES ('2', '存储模式', 'upload_mode', '1', '上传文件存储模式111', '1', '1', '2026-01-01 00:00:00', '2026-06-19 10:50:00', null);
INSERT INTO `sa_system_dict_type` VALUES ('3', '数据状态', 'data_status', '1', '通用数据状态', '1', '1', '2026-01-01 00:00:00', '2026-06-23 18:43:44', null);
INSERT INTO `sa_system_dict_type` VALUES ('4', '后台首页', 'dashboard', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-06-23 18:43:47', null);
INSERT INTO `sa_system_dict_type` VALUES ('5', '性别', 'gender', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-03-23 21:24:56', null);
INSERT INTO `sa_system_dict_type` VALUES ('12', '附件类型', 'attachment_type', '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dict_type` VALUES ('13', '菜单类型', 'menu_type', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_dict_type` VALUES ('14', '是否', 'yes_or_no', '1', '11', '1', '1', '2026-01-01 00:00:00', '2026-03-28 18:03:01', null);
INSERT INTO `sa_system_dict_type` VALUES ('20', '定时任务类型', 'crontab_task_type', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-03-31 00:30:35', null);
INSERT INTO `sa_system_dict_type` VALUES ('21', '111', '111', '1', '', '1', '1', '2026-03-23 21:25:10', '2026-03-23 22:48:47', '2026-03-23 22:48:47');

-- ----------------------------
-- Table structure for `sa_system_login_log`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_login_log`;
CREATE TABLE `sa_system_login_log` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `username` varchar(20) DEFAULT NULL COMMENT '用户名',
  `ip` varchar(45) DEFAULT NULL COMMENT '登录IP地址',
  `ip_location` varchar(255) DEFAULT NULL COMMENT 'IP所属地',
  `os` varchar(50) DEFAULT NULL COMMENT '操作系统',
  `browser` varchar(50) DEFAULT NULL COMMENT '浏览器',
  `status` smallint(6) DEFAULT '1' COMMENT '登录状态 (1成功 2失败)',
  `message` varchar(50) DEFAULT NULL COMMENT '提示消息',
  `login_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '登录时间',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` int(11) DEFAULT NULL COMMENT '创建者',
  `updated_by` int(11) DEFAULT NULL COMMENT '更新者',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '更新时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=732 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='系统访问记录';

-- ----------------------------
-- Records of sa_system_login_log
-- ----------------------------

-- ----------------------------
-- Table structure for `sa_system_mail`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_mail`;
CREATE TABLE `sa_system_mail` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '编号',
  `gateway` varchar(50) DEFAULT NULL COMMENT '网关',
  `from` varchar(50) DEFAULT NULL COMMENT '发送人',
  `email` varchar(50) DEFAULT NULL COMMENT '接收人',
  `code` varchar(20) DEFAULT NULL COMMENT '验证码',
  `content` varchar(500) DEFAULT NULL COMMENT '邮箱内容',
  `status` varchar(20) DEFAULT NULL COMMENT '发送状态',
  `response` varchar(500) DEFAULT NULL COMMENT '返回结果',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_create_time` (`create_time`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='邮件记录';

-- ----------------------------
-- Records of sa_system_mail
-- ----------------------------
INSERT INTO `sa_system_mail` VALUES ('1', 'mail.163.com', 'test@qq.com', 'admin@qq.com', '869', 'hello', 'success', 'data', '2026-03-23 19:53:53', null, null);
INSERT INTO `sa_system_mail` VALUES ('2', 'mail.qq.com', 'admin@test.com', 'admin@qq.com', '456', 'test', 'failure', 'data', '2026-03-23 19:52:49', '2026-03-28 18:41:38', null);

-- ----------------------------
-- Table structure for `sa_system_menu`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_menu`;
CREATE TABLE `sa_system_menu` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `parent_id` bigint(20) unsigned DEFAULT '0' COMMENT '父级ID',
  `name` varchar(64) NOT NULL COMMENT '菜单名称',
  `code` varchar(64) DEFAULT NULL COMMENT '组件名称',
  `slug` varchar(100) DEFAULT NULL COMMENT '权限标识，如 user:list, user:add',
  `type` tinyint(1) NOT NULL DEFAULT '1' COMMENT '类型: 1目录, 2菜单, 3按钮/API',
  `path` varchar(255) DEFAULT NULL COMMENT '路由地址(前端)或API路径(后端)',
  `component` varchar(255) DEFAULT NULL COMMENT '前端组件路径，如 layout/User',
  `method` varchar(10) DEFAULT NULL COMMENT '请求方式',
  `icon` varchar(64) DEFAULT NULL COMMENT '图标',
  `sort` int(11) DEFAULT '100' COMMENT '排序',
  `link_url` varchar(255) DEFAULT NULL COMMENT '外部链接',
  `is_iframe` tinyint(1) DEFAULT '2' COMMENT '是否iframe',
  `is_keep_alive` tinyint(1) DEFAULT '2' COMMENT '是否缓存',
  `is_hidden` tinyint(1) DEFAULT '2' COMMENT '是否隐藏',
  `is_fixed_tab` tinyint(1) DEFAULT '2' COMMENT '是否固定标签页',
  `is_full_page` tinyint(1) DEFAULT '2' COMMENT '是否全屏',
  `generate_id` int(11) DEFAULT '0' COMMENT '生成id',
  `generate_key` varchar(255) DEFAULT NULL COMMENT '生成key',
  `status` tinyint(1) DEFAULT '1' COMMENT '状态',
  `remark` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL COMMENT '创建者',
  `updated_by` int(11) DEFAULT NULL COMMENT '更新者',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=329 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='菜单权限表';

-- ----------------------------
-- Records of sa_system_menu
-- ----------------------------
INSERT INTO `sa_system_menu` VALUES ('1', '0', '仪表盘', 'Dashboard', '', '1', 'dashboard', '', null, 'ri:pie-chart-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-01-01 00:00:00', '2026-06-18 23:26:56', null);
INSERT INTO `sa_system_menu` VALUES ('2', '1', '工作台', 'Console', '', '2', 'console', '/dashboard/console', null, 'ri:home-smile-2-line', '100', '', '2', '2', '2', '1', '2', '0', null, '1', '', '1', '1', '2026-01-01 00:00:00', '2026-03-24 22:06:42', null);
INSERT INTO `sa_system_menu` VALUES ('3', '0', '系统管理', 'System', null, '1', '/system', '', null, 'ri:user-3-line', '100', null, '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('4', '3', '用户管理', 'User', null, '2', 'user', '/system/user', null, 'ri:user-line', '100', null, '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('5', '3', '部门管理', 'Dept', null, '2', 'dept', '/system/dept', null, 'ri:node-tree', '100', null, '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('6', '3', '角色管理', 'Role', null, '2', 'role', '/system/role', null, 'ri:admin-line', '100', null, '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('7', '3', '岗位管理', 'Post', '', '2', 'post', '/system/post', null, 'ri:signpost-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('8', '3', '菜单管理', 'Menu', null, '2', 'menu', '/system/menu', null, 'ri:menu-line', '100', null, '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('10', '0', '运维管理', 'Safeguard', null, '1', '/safeguard', '', null, 'ri:shield-check-line', '100', null, '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('11', '10', '缓存管理', 'Cache', '', '2', 'cache', '/safeguard/cache', null, 'ri:keyboard-box-line', '80', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('12', '10', '数据字典', 'Dict', null, '2', 'dict', '/safeguard/dict', null, 'ri:database-2-line', '100', null, '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('13', '10', '附件管理', 'Attachment', '', '2', 'attachment', '/safeguard/attachment', null, 'ri:file-cloud-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('14', '10', '数据表维护', 'Database', '', '2', 'database', '/safeguard/database', null, 'ri:database-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('15', '10', '登录日志', 'LoginLog', '', '2', 'login-log', '/safeguard/login-log', null, 'ri:login-circle-line', '50', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('16', '10', '操作日志', 'OperLog', '', '2', 'oper-log', '/safeguard/oper-log', null, 'ri:shield-keyhole-line', '50', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('17', '10', '邮件日志', 'EmailLog', '', '2', 'email-log', '/safeguard/email-log', null, 'ri:mail-line', '50', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('18', '3', '系统设置', 'Config', null, '2', 'config', '/system/config', null, 'ri:settings-4-line', '100', null, '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('19', '0', '官方文档', 'Document', '', '4', '', '', null, 'ri:file-copy-2-fill', '102', 'https://v3.phpframe.org', '1', '2', '2', '2', '2', '0', null, '0', '', '1', '1', '2026-01-01 00:00:00', '2026-05-16 18:00:47', null);
INSERT INTO `sa_system_menu` VALUES ('20', '4', '数据列表', '', 'core:user:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('21', '1', '个人中心', 'UserCenter', '', '2', 'user-center', '/dashboard/user-center/index', null, 'ri:user-2-line', '100', '', '2', '2', '1', '2', '2', '0', null, '1', '', '1', '1', '2026-01-01 00:00:00', '2026-06-19 21:52:05', null);
INSERT INTO `sa_system_menu` VALUES ('22', '4', '添加', '', 'core:user:save', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('23', '4', '修改', '', 'core:user:update', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('24', '4', '读取', '', 'core:user:read', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('25', '4', '删除', '', 'core:user:destroy', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('26', '4', '重置密码', '', 'core:user:password', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('27', '4', '清理缓存', '', 'core:user:cache', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('28', '4', '设置工作台', '', 'core:user:home', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('29', '5', '数据列表', '', 'core:dept:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('30', '5', '添加', '', 'core:dept:save', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('31', '5', '修改', '', 'core:dept:update', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('32', '5', '读取', '', 'core:dept:read', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('33', '5', '删除', '', 'core:dept:destroy', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('34', '6', '添加', '', 'core:role:save', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('35', '6', '数据列表', '', 'core:role:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('36', '6', '修改', '', 'core:role:update', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('37', '6', '读取', '', 'core:role:read', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('38', '6', '删除', '', 'core:role:destroy', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('39', '6', '菜单权限', '', 'core:role:menu', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('41', '7', '数据列表', '', 'core:post:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('42', '7', '添加', '', 'core:post:save', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('43', '7', '修改', '', 'core:post:update', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('44', '7', '读取', '', 'core:post:read', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('45', '7', '删除', '', 'core:post:destroy', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('46', '7', '导入', '', 'core:post:import', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('47', '7', '导出', '', 'core:post:export', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('48', '8', '数据列表', '', 'core:menu:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('49', '8', '读取', '', 'core:menu:read', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('50', '8', '添加', '', 'core:menu:save', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('51', '8', '修改', '', 'core:menu:update', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('52', '8', '删除', '', 'core:menu:destroy', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('53', '18', '数据列表', '', 'core:config:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('54', '18', '管理', '', 'core:config:edit', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('55', '18', '修改', '', 'core:config:update', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('56', '12', '数据列表', '', 'core:dict:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('57', '12', '管理', '', 'core:dict:edit', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('58', '13', '数据列表', '', 'core:attachment:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('59', '13', '管理', '', 'core:attachment:edit', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('60', '14', '数据表列表', '', 'core:database:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('61', '14', '数据表维护', '', 'core:database:edit', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('62', '14', '回收站数据', '', 'core:recycle:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('63', '14', '回收站管理', '', 'core:recycle:edit', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('64', '15', '数据列表', '', 'core:logs:login', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('65', '15', '删除', '', 'core:logs:deleteLogin', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('66', '16', '数据列表', '', 'core:logs:Oper', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('67', '16', '删除', '', 'core:logs:deleteOper', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('68', '17', '数据列表', '', 'core:email:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('69', '17', '删除', '', 'core:email:destroy', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('70', '10', '服务监控', 'Server', '', '2', 'server', '/safeguard/server', null, 'ri:server-line', '90', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('71', '70', '数据列表', '', 'core:server:monitor', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('72', '11', '数据列表', '', 'core:server:cache', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('73', '11', '缓存清理', '', 'core:server:clear', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('74', '2', '登录数据统计', '', 'core:console:list', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('75', '0', '附加权限', 'Permission', '', '1', 'permission', '', null, 'ri:apps-2-ai-line', '100', '', '2', '2', '1', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('76', '75', '上传图片', '', 'core:system:uploadImage', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('77', '75', '上传文件', '', 'core:system:uploadFile', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('78', '75', '附件列表', '', 'core:system:resource', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('79', '75', '用户列表', '', 'core:system:user', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('80', '0', '开发工具', 'Tool', '', '1', '/tool', '', null, 'ri:tools-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-01-01 00:00:00', '2026-03-23 23:03:00', null);
INSERT INTO `sa_system_menu` VALUES ('81', '80', '代码生成', 'Code', '', '2', 'code', '/tool/code', null, 'ri:code-s-slash-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-01-01 00:00:00', '2026-04-26 17:08:04', null);
INSERT INTO `sa_system_menu` VALUES ('82', '80', '定时任务', 'Crontab', '', '2', 'crontab', '/tool/crontab', null, 'ri:time-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('83', '82', '数据列表', '', 'tool:crontab:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('84', '82', '管理', '', 'tool:crontab:edit', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('85', '82', '运行任务', '', 'tool:crontab:run', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('86', '81', '数据列表', '', 'tool:code:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('87', '81', '管理', '', 'tool:code:edit', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu` VALUES ('88', '10', '在线用户', 'Plugin', '', '2', 'online', '/safeguard/online/index', null, 'ri:speak-ai-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-01-01 00:00:00', '2026-06-19 11:23:04', null);
INSERT INTO `sa_system_menu` VALUES ('92', '4', '分配菜单', '', 'core:user:menu', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '0', '', '1', '1', '2026-03-24 22:56:49', '2026-03-24 22:56:49', null);
INSERT INTO `sa_system_menu` VALUES ('93', '1', '分析页', 'Analysis', '', '2', 'analysis', '/dashboard/analysis', null, 'ri:file-music-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-03-25 20:28:34', '2026-03-29 14:28:06', null);
INSERT INTO `sa_system_menu` VALUES ('94', '1', '电子商务', 'Ecommerce', '', '2', 'ecommerce', '/dashboard/ecommerce', null, 'ri:bootstrap-fill', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-03-25 20:42:29', '2026-03-29 14:39:56', null);
INSERT INTO `sa_system_menu` VALUES ('95', '80', '表单示例', 'Form', '', '2', 'form', '/tool/form', null, 'ri:article-line', '100', '', '2', '2', '2', '2', '2', '0', null, '0', '', '1', '1', '2026-03-25 20:47:03', '2026-03-25 20:47:44', null);
INSERT INTO `sa_system_menu` VALUES ('96', '88', '111', null, 'chajian:market:add', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-03-28 19:41:47', '2026-03-28 20:05:26', '2026-03-28 20:05:26');
INSERT INTO `sa_system_menu` VALUES ('97', '5', '菜单树', null, 'core:dept:tree', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-03-29 18:03:52', '2026-03-29 18:03:52', null);
INSERT INTO `sa_system_menu` VALUES ('98', '3', '租户管理', 'Tenant', '', '2', 'tenant', '/system/tenant', null, 'ri:dashboard-horizontal-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-04-06 21:24:21', '2026-04-06 21:36:53', null);
INSERT INTO `sa_system_menu` VALUES ('99', '98', '数据列表', null, 'core:tenant:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-04-06 21:30:15', '2026-04-06 21:30:15', null);
INSERT INTO `sa_system_menu` VALUES ('100', '98', '读取', '', 'core:tenant:read', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-04-06 22:00:15', '2026-04-06 22:00:15', null);
INSERT INTO `sa_system_menu` VALUES ('101', '98', '添加', '', 'core:tenant:save', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-04-06 22:01:03', '2026-04-06 22:01:03', null);
INSERT INTO `sa_system_menu` VALUES ('102', '98', '修改', '', 'core:tenant:update', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-04-06 22:01:24', '2026-04-06 22:01:24', null);
INSERT INTO `sa_system_menu` VALUES ('103', '98', '删除', '', 'core:tenant:destroy', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-04-06 22:01:53', '2026-04-06 22:01:53', null);
INSERT INTO `sa_system_menu` VALUES ('104', '10', 'Redis监控', 'Redis', 'core:server:redis', '2', 'redis', '/safeguard/redis', null, 'ri:exchange-cny-fill', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-04-20 22:44:29', '2026-04-21 00:33:07', null);
INSERT INTO `sa_system_menu` VALUES ('105', '0', '文章管理', 'Article', '', '1', 'article', '', null, 'ri:book-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-04-23 22:18:18', '2026-04-26 17:07:50', null);
INSERT INTO `sa_system_menu` VALUES ('106', '105', '文章列表', 'ArticleList', '', '2', '/article/index', '/article', null, 'ri:code-block', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-04-23 22:19:39', '2026-04-26 17:08:18', null);
INSERT INTO `sa_system_menu` VALUES ('173', '1', 'HRM看板', 'Hrm', '', '2', 'hrm', '/dashboard/hrm', null, 'ri:team-line', '100', null, '2', '2', '2', '2', '2', '0', null, '1', '人力资源看板', '1', '1', '2026-05-06 23:15:10', '2026-05-06 23:15:10', null);
INSERT INTO `sa_system_menu` VALUES ('183', '1', '赞助支持', 'DashboardSponsor', '', '2', 'sponsor', '/dashboard/sponsor', null, 'ri:hand-heart-line', '110', null, '2', '2', '2', '2', '2', '0', null, '1', '项目赞助说明页', '1', '1', '2026-05-16 21:08:42', '2026-05-16 21:08:42', null);
INSERT INTO `sa_system_menu` VALUES ('200', '0', 'AI 助手', 'Ai', '', '1', 'ai', '', null, 'ri:robot-2-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-21 22:11:20', '2026-06-21 22:11:58', null);
INSERT INTO `sa_system_menu` VALUES ('201', '200', 'AI 对话', 'AiChat', 'ai:chat:use', '2', '/ai/chat/index', '/ai/chat', null, 'ri:chat-3-line', '100', '', '2', '1', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-21 22:11:20', '2026-06-21 22:11:20', null);
INSERT INTO `sa_system_menu` VALUES ('202', '200', '模型供应商', 'AiProvider', 'ai:provider:list', '2', '/ai/provider/index', '/ai/provider', null, 'ri:cloud-line', '90', '', '2', '1', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-21 22:11:20', '2026-06-21 22:11:20', null);
INSERT INTO `sa_system_menu` VALUES ('203', '200', '模型配置', 'AiModel', 'ai:model:list', '2', '/ai/model/index', '/ai/model', null, 'ri:cpu-line', '80', '', '2', '1', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-21 22:11:20', '2026-06-21 22:11:20', null);
INSERT INTO `sa_system_menu` VALUES ('204', '202', '新增供应商', '', 'ai:provider:save', '3', '', '', null, '', '100', null, '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-06-21 22:11:20', '2026-06-21 22:11:20', null);
INSERT INTO `sa_system_menu` VALUES ('205', '202', '编辑供应商', '', 'ai:provider:update', '3', '', '', null, '', '99', null, '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-06-21 22:11:20', '2026-06-21 22:11:20', null);
INSERT INTO `sa_system_menu` VALUES ('206', '202', '删除供应商', '', 'ai:provider:delete', '3', '', '', null, '', '98', null, '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-06-21 22:11:20', '2026-06-21 22:11:20', null);
INSERT INTO `sa_system_menu` VALUES ('207', '203', '新增模型', '', 'ai:model:save', '3', '', '', null, '', '100', null, '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-06-21 22:11:20', '2026-06-21 22:11:20', null);
INSERT INTO `sa_system_menu` VALUES ('208', '203', '编辑模型', '', 'ai:model:update', '3', '', '', null, '', '99', null, '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-06-21 22:11:20', '2026-06-21 22:11:20', null);
INSERT INTO `sa_system_menu` VALUES ('209', '203', '删除模型', '', 'ai:model:delete', '3', '', '', null, '', '98', null, '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-06-21 22:11:20', '2026-06-21 22:11:20', null);
INSERT INTO `sa_system_menu` VALUES ('300', '0', 'RAG智能系统', 'RAGSystem', '', '1', '/ragsystem', '', null, 'ri:brain-line', '101', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-25 00:48:25', '2026-06-26 22:47:02', null);
INSERT INTO `sa_system_menu` VALUES ('301', '320', '工作空间', 'RagPlatform', 'taixu:platform:use', '2', 'platform/index', '/taixu/platform', null, 'ri:dashboard-line', '95', '', '2', '1', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-25 00:48:25', '2026-06-26 22:47:40', null);
INSERT INTO `sa_system_menu` VALUES ('302', '320', '模型管理', 'TaixuModel', 'taixu:model:use', '2', 'model/index', '/taixu/model', null, 'ri:cpu-line', '96', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-25 00:48:25', '2026-06-26 22:40:30', null);
INSERT INTO `sa_system_menu` VALUES ('303', '320', '系统设置', 'TaixuSetting', 'taixu:setting:use', '2', 'setting/index', '/taixu/setting', null, 'ri:settings-3-line', '97', '', '2', '1', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-25 00:48:26', '2026-06-26 22:40:00', null);
INSERT INTO `sa_system_menu` VALUES ('304', '300', '用户管理', 'TaixuUser', 'taixu:user:use', '2', 'user/index', '/taixu/user', null, 'ri:user-3-line', '85', '', '2', '1', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-25 00:48:26', '2026-06-26 22:27:57', '2026-06-26 22:27:57');
INSERT INTO `sa_system_menu` VALUES ('305', '321', 'LLM 对话', 'TaixuLlm', 'taixu:llm:use', '2', 'llm/index', '/taixu/llm', null, 'ri:chat-3-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-25 00:48:26', '2026-06-26 22:40:56', null);
INSERT INTO `sa_system_menu` VALUES ('306', '321', '图片生成', 'TaixuImage', 'taixu:image:use', '2', 'image/index', '/taixu/image', null, 'ri:image-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-25 00:48:26', '2026-06-26 22:40:48', null);
INSERT INTO `sa_system_menu` VALUES ('307', '322', '知识库管理', 'TaixuDocument', 'taixu:document:use', '2', 'document/index', '/taixu/document', null, 'ri:folder-2-line', '70', '', '2', '1', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-25 00:48:26', '2026-06-26 22:05:44', null);
INSERT INTO `sa_system_menu` VALUES ('308', '323', '文档检索', 'TaixuRetrieval', 'taixu:retrieval:use', '2', 'retrieval/index', '/taixu/retrieval/index', null, 'ri:search-line', '95', '', '2', '1', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-25 00:48:26', '2026-06-26 22:41:22', null);
INSERT INTO `sa_system_menu` VALUES ('309', '323', '智能检索', 'TaixuAdvance', 'taixu:advance:use', '2', 'advance/index', '/taixu/advance/index', null, 'ri:compass-3-line', '96', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-25 00:48:26', '2026-06-26 22:41:34', null);
INSERT INTO `sa_system_menu` VALUES ('310', '323', '特殊检索', 'TaixuSpecial', 'taixu:special:use', '2', 'special/index', '/taixu/special/index', null, 'ri:magic-line', '97', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-25 00:48:26', '2026-06-26 22:41:42', null);
INSERT INTO `sa_system_menu` VALUES ('311', '324', 'Arxiv 检索', 'TaixuArxiv', 'taixu:arxiv:use', '2', 'arxiv/index', '/taixu/arxiv/index', null, 'ri:book-2-line', '95', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-25 00:48:26', '2026-06-26 22:42:40', null);
INSERT INTO `sa_system_menu` VALUES ('312', '324', '编程检索', 'TaixuProgram', 'taixu:program:use', '2', 'program/index', '/taixu/program/index', null, 'ri:code-s-slash-line', '96', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-25 00:48:26', '2026-06-26 22:42:46', null);
INSERT INTO `sa_system_menu` VALUES ('313', '326', '智能问答', 'TaixuAnswer', 'taixu:answer:use', '2', 'answer/index', '/taixu/answer/index', null, 'ri:question-answer-line', '95', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-25 00:48:26', '2026-06-26 22:44:51', null);
INSERT INTO `sa_system_menu` VALUES ('314', '326', '多智能体', 'TaixuAgentic', 'taixu:agentic:use', '2', 'agentic/index', '/taixu/agentic/index', null, 'ri:group-line', '96', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-25 00:48:26', '2026-06-26 22:44:46', null);
INSERT INTO `sa_system_menu` VALUES ('315', '328', '智能搜索', 'TaixuSearch', 'taixu:search:use', '2', 'search/index', '/taixu/search/index', null, 'ri:global-line', '95', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-25 00:48:26', '2026-06-26 22:45:05', null);
INSERT INTO `sa_system_menu` VALUES ('316', '328', '主题报告', 'TaixuTopic', 'taixu:topic:use', '2', 'topic/index', '/taixu/topic/index', null, 'ri:file-list-3-line', '96', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-25 00:48:26', '2026-06-26 22:45:13', null);
INSERT INTO `sa_system_menu` VALUES ('317', '328', '旅游助手', 'TaixuTravel', 'taixu:travel:use', '2', 'travel/index', '/taixu/travel/index', null, 'ri:plane-line', '97', '', '2', '1', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-25 00:48:26', '2026-06-26 22:45:18', null);
INSERT INTO `sa_system_menu` VALUES ('318', '320', '关于系统', 'TaixuDetail', 'taixu:detail:use', '2', 'about/index', '/taixu/detail/index', null, 'ri:information-line', '99', '', '2', '1', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-25 00:48:26', '2026-06-26 22:40:13', null);
INSERT INTO `sa_system_menu` VALUES ('319', '328', '智能报告助手', 'CustomReport', 'taixu:custom:use', '2', 'custom/index', '/taixu/custom/index', null, 'ri:sparkling-2-line', '98', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-25 00:48:26', '2026-06-30 22:39:22', null);
INSERT INTO `sa_system_menu` VALUES ('320', '300', '系统设置', 'ModelConfig', '', '1', 'modelconfig', '', null, 'ri:folder-settings-fill', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-26 21:58:57', '2026-06-26 22:28:27', null);
INSERT INTO `sa_system_menu` VALUES ('321', '300', 'Model', 'Model', '', '1', 'llmmodel', '', null, 'ri:sound-module-fill', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-26 22:03:09', '2026-06-26 22:03:09', null);
INSERT INTO `sa_system_menu` VALUES ('322', '300', 'RAG', 'RAG', '', '1', 'rag', '', null, 'ri:archive-drawer-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-26 22:05:30', '2026-06-26 22:05:30', null);
INSERT INTO `sa_system_menu` VALUES ('323', '322', 'RAG模式', 'RagModel', '', '1', 'ragmodel', '', null, 'ri:paragraph', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-26 22:06:42', '2026-06-26 22:06:42', null);
INSERT INTO `sa_system_menu` VALUES ('324', '322', 'RAG应用', 'RagApp', '', '1', 'ragapp', '', null, 'ri:app-store-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-26 22:08:06', '2026-06-26 22:09:32', null);
INSERT INTO `sa_system_menu` VALUES ('325', '300', 'Agent', 'Agent', '', '1', 'agent', '', null, 'ri:collage-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-26 22:12:36', '2026-06-26 22:12:36', null);
INSERT INTO `sa_system_menu` VALUES ('326', '325', 'Agent模式', 'AgentModel', '', '1', 'agentmodel', '', null, 'ri:cake-3-fill', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-26 22:13:36', '2026-06-26 22:13:36', null);
INSERT INTO `sa_system_menu` VALUES ('328', '325', 'Agent应用', 'AgentApps', '', '1', 'agentapps', '', null, 'ri:scroll-to-bottom-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-06-26 22:23:08', '2026-06-26 22:23:08', null);

-- ----------------------------
-- Table structure for `sa_system_menu_copy`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_menu_copy`;
CREATE TABLE `sa_system_menu_copy` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `parent_id` bigint(20) unsigned DEFAULT '0' COMMENT '父级ID',
  `name` varchar(64) NOT NULL COMMENT '菜单名称',
  `code` varchar(64) DEFAULT NULL COMMENT '组件名称',
  `slug` varchar(100) DEFAULT NULL COMMENT '权限标识，如 user:list, user:add',
  `type` tinyint(1) NOT NULL DEFAULT '1' COMMENT '类型: 1目录, 2菜单, 3按钮/API',
  `path` varchar(255) DEFAULT NULL COMMENT '路由地址(前端)或API路径(后端)',
  `component` varchar(255) DEFAULT NULL COMMENT '前端组件路径，如 layout/User',
  `method` varchar(10) DEFAULT NULL COMMENT '请求方式',
  `icon` varchar(64) DEFAULT NULL COMMENT '图标',
  `sort` int(11) DEFAULT '100' COMMENT '排序',
  `link_url` varchar(255) DEFAULT NULL COMMENT '外部链接',
  `is_iframe` tinyint(1) DEFAULT '2' COMMENT '是否iframe',
  `is_keep_alive` tinyint(1) DEFAULT '2' COMMENT '是否缓存',
  `is_hidden` tinyint(1) DEFAULT '2' COMMENT '是否隐藏',
  `is_fixed_tab` tinyint(1) DEFAULT '2' COMMENT '是否固定标签页',
  `is_full_page` tinyint(1) DEFAULT '2' COMMENT '是否全屏',
  `generate_id` int(11) DEFAULT '0' COMMENT '生成id',
  `generate_key` varchar(255) DEFAULT NULL COMMENT '生成key',
  `status` tinyint(1) DEFAULT '1' COMMENT '状态',
  `remark` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL COMMENT '创建者',
  `updated_by` int(11) DEFAULT NULL COMMENT '更新者',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=184 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='菜单权限表';

-- ----------------------------
-- Records of sa_system_menu_copy
-- ----------------------------
INSERT INTO `sa_system_menu_copy` VALUES ('1', '0', '仪表盘', 'Dashboard', '', '1', 'dashboard', '', null, 'ri:pie-chart-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-01-01 00:00:00', '2026-06-18 23:26:56', null);
INSERT INTO `sa_system_menu_copy` VALUES ('2', '1', '工作台', 'Console', '', '2', 'console', '/dashboard/console', null, 'ri:home-smile-2-line', '100', '', '2', '2', '2', '1', '2', '0', null, '1', '', '1', '1', '2026-01-01 00:00:00', '2026-03-24 22:06:42', null);
INSERT INTO `sa_system_menu_copy` VALUES ('3', '0', '系统管理', 'System', null, '1', '/system', '', null, 'ri:user-3-line', '100', null, '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('4', '3', '用户管理', 'User', null, '2', 'user', '/system/user', null, 'ri:user-line', '100', null, '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('5', '3', '部门管理', 'Dept', null, '2', 'dept', '/system/dept', null, 'ri:node-tree', '100', null, '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('6', '3', '角色管理', 'Role', null, '2', 'role', '/system/role', null, 'ri:admin-line', '100', null, '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('7', '3', '岗位管理', 'Post', '', '2', 'post', '/system/post', null, 'ri:signpost-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('8', '3', '菜单管理', 'Menu', null, '2', 'menu', '/system/menu', null, 'ri:menu-line', '100', null, '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('10', '0', '运维管理', 'Safeguard', null, '1', '/safeguard', '', null, 'ri:shield-check-line', '100', null, '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('11', '10', '缓存管理', 'Cache', '', '2', 'cache', '/safeguard/cache', null, 'ri:keyboard-box-line', '80', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('12', '10', '数据字典', 'Dict', null, '2', 'dict', '/safeguard/dict', null, 'ri:database-2-line', '100', null, '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('13', '10', '附件管理', 'Attachment', '', '2', 'attachment', '/safeguard/attachment', null, 'ri:file-cloud-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('14', '10', '数据表维护', 'Database', '', '2', 'database', '/safeguard/database', null, 'ri:database-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('15', '10', '登录日志', 'LoginLog', '', '2', 'login-log', '/safeguard/login-log', null, 'ri:login-circle-line', '50', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('16', '10', '操作日志', 'OperLog', '', '2', 'oper-log', '/safeguard/oper-log', null, 'ri:shield-keyhole-line', '50', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('17', '10', '邮件日志', 'EmailLog', '', '2', 'email-log', '/safeguard/email-log', null, 'ri:mail-line', '50', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('18', '3', '系统设置', 'Config', null, '2', 'config', '/system/config', null, 'ri:settings-4-line', '100', null, '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('19', '0', '官方文档', 'Document', '', '4', '', '', null, 'ri:file-copy-2-fill', '102', 'https://v3.phpframe.org', '1', '2', '2', '2', '2', '0', null, '0', '', '1', '1', '2026-01-01 00:00:00', '2026-05-16 18:00:47', null);
INSERT INTO `sa_system_menu_copy` VALUES ('20', '4', '数据列表', '', 'core:user:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('21', '1', '个人中心', 'UserCenter', '', '2', 'user-center', '/dashboard/user-center/index', null, 'ri:user-2-line', '100', '', '2', '2', '1', '2', '2', '0', null, '1', '', '1', '1', '2026-01-01 00:00:00', '2026-06-19 21:52:05', null);
INSERT INTO `sa_system_menu_copy` VALUES ('22', '4', '添加', '', 'core:user:save', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('23', '4', '修改', '', 'core:user:update', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('24', '4', '读取', '', 'core:user:read', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('25', '4', '删除', '', 'core:user:destroy', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('26', '4', '重置密码', '', 'core:user:password', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('27', '4', '清理缓存', '', 'core:user:cache', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('28', '4', '设置工作台', '', 'core:user:home', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('29', '5', '数据列表', '', 'core:dept:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('30', '5', '添加', '', 'core:dept:save', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('31', '5', '修改', '', 'core:dept:update', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('32', '5', '读取', '', 'core:dept:read', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('33', '5', '删除', '', 'core:dept:destroy', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('34', '6', '添加', '', 'core:role:save', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('35', '6', '数据列表', '', 'core:role:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('36', '6', '修改', '', 'core:role:update', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('37', '6', '读取', '', 'core:role:read', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('38', '6', '删除', '', 'core:role:destroy', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('39', '6', '菜单权限', '', 'core:role:menu', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('41', '7', '数据列表', '', 'core:post:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('42', '7', '添加', '', 'core:post:save', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('43', '7', '修改', '', 'core:post:update', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('44', '7', '读取', '', 'core:post:read', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('45', '7', '删除', '', 'core:post:destroy', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('46', '7', '导入', '', 'core:post:import', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('47', '7', '导出', '', 'core:post:export', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('48', '8', '数据列表', '', 'core:menu:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('49', '8', '读取', '', 'core:menu:read', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('50', '8', '添加', '', 'core:menu:save', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('51', '8', '修改', '', 'core:menu:update', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('52', '8', '删除', '', 'core:menu:destroy', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('53', '18', '数据列表', '', 'core:config:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('54', '18', '管理', '', 'core:config:edit', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('55', '18', '修改', '', 'core:config:update', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('56', '12', '数据列表', '', 'core:dict:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('57', '12', '管理', '', 'core:dict:edit', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('58', '13', '数据列表', '', 'core:attachment:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('59', '13', '管理', '', 'core:attachment:edit', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('60', '14', '数据表列表', '', 'core:database:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('61', '14', '数据表维护', '', 'core:database:edit', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('62', '14', '回收站数据', '', 'core:recycle:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('63', '14', '回收站管理', '', 'core:recycle:edit', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('64', '15', '数据列表', '', 'core:logs:login', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('65', '15', '删除', '', 'core:logs:deleteLogin', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('66', '16', '数据列表', '', 'core:logs:Oper', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('67', '16', '删除', '', 'core:logs:deleteOper', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('68', '17', '数据列表', '', 'core:email:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('69', '17', '删除', '', 'core:email:destroy', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('70', '10', '服务监控', 'Server', '', '2', 'server', '/safeguard/server', null, 'ri:server-line', '90', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('71', '70', '数据列表', '', 'core:server:monitor', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('72', '11', '数据列表', '', 'core:server:cache', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('73', '11', '缓存清理', '', 'core:server:clear', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('74', '2', '登录数据统计', '', 'core:console:list', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('75', '0', '附加权限', 'Permission', '', '1', 'permission', '', null, 'ri:apps-2-ai-line', '100', '', '2', '2', '1', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('76', '75', '上传图片', '', 'core:system:uploadImage', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('77', '75', '上传文件', '', 'core:system:uploadFile', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('78', '75', '附件列表', '', 'core:system:resource', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('79', '75', '用户列表', '', 'core:system:user', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('80', '0', '开发工具', 'Tool', '', '1', '/tool', '', null, 'ri:tools-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-01-01 00:00:00', '2026-03-23 23:03:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('81', '80', '代码生成', 'Code', '', '2', 'code', '/tool/code', null, 'ri:code-s-slash-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-01-01 00:00:00', '2026-04-26 17:08:04', null);
INSERT INTO `sa_system_menu_copy` VALUES ('82', '80', '定时任务', 'Crontab', '', '2', 'crontab', '/tool/crontab', null, 'ri:time-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('83', '82', '数据列表', '', 'tool:crontab:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('84', '82', '管理', '', 'tool:crontab:edit', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('85', '82', '运行任务', '', 'tool:crontab:run', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('86', '81', '数据列表', '', 'tool:code:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('87', '81', '管理', '', 'tool:code:edit', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', null, '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_menu_copy` VALUES ('88', '10', '在线用户', 'Plugin', '', '2', 'online', '/safeguard/online/index', null, 'ri:speak-ai-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-01-01 00:00:00', '2026-06-19 11:23:04', null);
INSERT INTO `sa_system_menu_copy` VALUES ('92', '4', '分配菜单', '', 'core:user:menu', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '0', '', '1', '1', '2026-03-24 22:56:49', '2026-03-24 22:56:49', null);
INSERT INTO `sa_system_menu_copy` VALUES ('93', '1', '分析页', 'Analysis', '', '2', 'analysis', '/dashboard/analysis', null, 'ri:file-music-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-03-25 20:28:34', '2026-03-29 14:28:06', null);
INSERT INTO `sa_system_menu_copy` VALUES ('94', '1', '电子商务', 'Ecommerce', '', '2', 'ecommerce', '/dashboard/ecommerce', null, 'ri:bootstrap-fill', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-03-25 20:42:29', '2026-03-29 14:39:56', null);
INSERT INTO `sa_system_menu_copy` VALUES ('95', '80', '表单示例', 'Form', '', '2', 'form', '/tool/form', null, 'ri:article-line', '100', '', '2', '2', '2', '2', '2', '0', null, '0', '', '1', '1', '2026-03-25 20:47:03', '2026-03-25 20:47:44', null);
INSERT INTO `sa_system_menu_copy` VALUES ('96', '88', '111', null, 'chajian:market:add', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-03-28 19:41:47', '2026-03-28 20:05:26', '2026-03-28 20:05:26');
INSERT INTO `sa_system_menu_copy` VALUES ('97', '5', '菜单树', null, 'core:dept:tree', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-03-29 18:03:52', '2026-03-29 18:03:52', null);
INSERT INTO `sa_system_menu_copy` VALUES ('98', '3', '租户管理', 'Tenant', '', '2', 'tenant', '/system/tenant', null, 'ri:dashboard-horizontal-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-04-06 21:24:21', '2026-04-06 21:36:53', null);
INSERT INTO `sa_system_menu_copy` VALUES ('99', '98', '数据列表', null, 'core:tenant:index', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-04-06 21:30:15', '2026-04-06 21:30:15', null);
INSERT INTO `sa_system_menu_copy` VALUES ('100', '98', '读取', '', 'core:tenant:read', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-04-06 22:00:15', '2026-04-06 22:00:15', null);
INSERT INTO `sa_system_menu_copy` VALUES ('101', '98', '添加', '', 'core:tenant:save', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-04-06 22:01:03', '2026-04-06 22:01:03', null);
INSERT INTO `sa_system_menu_copy` VALUES ('102', '98', '修改', '', 'core:tenant:update', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-04-06 22:01:24', '2026-04-06 22:01:24', null);
INSERT INTO `sa_system_menu_copy` VALUES ('103', '98', '删除', '', 'core:tenant:destroy', '3', '', '', null, '', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-04-06 22:01:53', '2026-04-06 22:01:53', null);
INSERT INTO `sa_system_menu_copy` VALUES ('104', '10', 'Redis监控', 'Redis', 'core:server:redis', '2', 'redis', '/safeguard/redis', null, 'ri:exchange-cny-fill', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-04-20 22:44:29', '2026-04-21 00:33:07', null);
INSERT INTO `sa_system_menu_copy` VALUES ('105', '0', '文章管理', 'Article', '', '1', 'article', '', null, 'ri:book-line', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-04-23 22:18:18', '2026-04-26 17:07:50', null);
INSERT INTO `sa_system_menu_copy` VALUES ('106', '105', '文章列表', 'ArticleList', '', '2', '/article/index', '/article', null, 'ri:code-block', '100', '', '2', '2', '2', '2', '2', '0', null, '1', '', '1', '1', '2026-04-23 22:19:39', '2026-04-26 17:08:18', null);
INSERT INTO `sa_system_menu_copy` VALUES ('173', '1', 'HRM看板', 'Hrm', '', '2', 'hrm', '/dashboard/hrm', null, 'ri:team-line', '100', null, '2', '2', '2', '2', '2', '0', null, '1', '人力资源看板', '1', '1', '2026-05-06 23:15:10', '2026-05-06 23:15:10', null);
INSERT INTO `sa_system_menu_copy` VALUES ('183', '1', '赞助支持', 'DashboardSponsor', '', '2', 'sponsor', '/dashboard/sponsor', null, 'ri:hand-heart-line', '110', null, '2', '2', '2', '2', '2', '0', null, '1', '项目赞助说明页', '1', '1', '2026-05-16 21:08:42', '2026-05-16 21:08:42', null);

-- ----------------------------
-- Table structure for `sa_system_notice`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_notice`;
CREATE TABLE `sa_system_notice` (
  `created_by` int(11) DEFAULT NULL COMMENT '创建者',
  `updated_by` int(11) DEFAULT NULL COMMENT '更新者',
  `create_time` datetime(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `update_time` datetime(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '修改时间',
  `delete_time` datetime(6) DEFAULT NULL COMMENT '删除时间',
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '公告ID',
  `title` varchar(100) NOT NULL DEFAULT '' COMMENT '公告标题',
  `type` tinyint(4) NOT NULL DEFAULT '1' COMMENT '公告类型（1通知 2公告）',
  `content` longtext COMMENT '公告内容',
  `status` tinyint(4) NOT NULL DEFAULT '1' COMMENT '状态（1启用 0禁用）',
  `remark` varchar(255) NOT NULL DEFAULT '' COMMENT '备注',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知公告表';

-- ----------------------------
-- Records of sa_system_notice
-- ----------------------------

-- ----------------------------
-- Table structure for `sa_system_oper_log`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_oper_log`;
CREATE TABLE `sa_system_oper_log` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `username` varchar(20) DEFAULT NULL COMMENT '用户名',
  `app` varchar(50) DEFAULT NULL COMMENT '应用名称',
  `method` varchar(20) DEFAULT NULL COMMENT '请求方式',
  `router` varchar(500) DEFAULT NULL COMMENT '请求路由',
  `service_name` varchar(30) DEFAULT NULL COMMENT '业务名称',
  `ip` varchar(45) DEFAULT NULL COMMENT '请求IP地址',
  `ip_location` varchar(255) DEFAULT NULL COMMENT 'IP所属地',
  `request_data` text COMMENT '请求数据',
  `duration` varchar(20) DEFAULT NULL COMMENT '耗时',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` int(11) DEFAULT NULL COMMENT '创建者',
  `updated_by` int(11) DEFAULT NULL COMMENT '更新者',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '更新时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=2154 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='操作日志记录';

-- ----------------------------
-- Records of sa_system_oper_log
-- ----------------------------

-- ----------------------------
-- Table structure for `sa_system_post`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_post`;
CREATE TABLE `sa_system_post` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name` varchar(50) DEFAULT NULL COMMENT '岗位名称',
  `code` varchar(100) DEFAULT NULL COMMENT '岗位代码',
  `sort` smallint(5) unsigned DEFAULT '0' COMMENT '排序',
  `status` smallint(6) DEFAULT '1' COMMENT '状态 (1正常 2停用)',
  `tenant_id` bigint(20) unsigned NOT NULL DEFAULT '0' COMMENT '所属租户ID，0表示系统级',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` int(11) DEFAULT NULL COMMENT '创建者',
  `updated_by` int(11) DEFAULT NULL COMMENT '更新者',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='岗位信息表';

-- ----------------------------
-- Records of sa_system_post
-- ----------------------------
INSERT INTO `sa_system_post` VALUES ('1', '司机岗', 'driver', '100', '1', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-06-21 19:34:09', null);
INSERT INTO `sa_system_post` VALUES ('2', '保安岗', 'security', '100', '1', '1', '', '1', '1', '2026-01-01 00:00:00', '2026-06-23 18:01:02', null);
INSERT INTO `sa_system_post` VALUES ('3', '11', '11', '100', '1', '1', '1233', '1', '1', '2026-03-22 12:12:55', '2026-03-22 12:13:12', '2026-03-22 12:13:12');
INSERT INTO `sa_system_post` VALUES ('4', '111', '111', '100', '2', '1', '11111', '1', '1', '2026-03-22 12:47:53', '2026-03-22 13:33:02', '2026-03-22 13:33:02');
INSERT INTO `sa_system_post` VALUES ('5', 'aa', 'aaa', '100', '1', '1', '', '1', '1', '2026-03-27 21:45:50', '2026-03-28 19:08:12', '2026-03-28 19:08:12');
INSERT INTO `sa_system_post` VALUES ('6', '111', '11111', '100', '1', '1', '', '1', '1', '2026-03-28 19:32:14', '2026-03-28 19:32:23', '2026-03-28 19:32:23');
INSERT INTO `sa_system_post` VALUES ('7', '开发岗', 'dev', '100', '1', '2', '', '1', '1', '2026-06-21 19:57:01', '2026-06-21 19:57:01', null);

-- ----------------------------
-- Table structure for `sa_system_role`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_role`;
CREATE TABLE `sa_system_role` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `parent_id` bigint(20) unsigned NOT NULL DEFAULT '0' COMMENT '父角色ID，0表示顶级角色',
  `name` varchar(64) NOT NULL COMMENT '角色名称',
  `code` varchar(64) NOT NULL COMMENT '角色标识(英文唯一)，如: hr_manager',
  `level` int(11) DEFAULT '1' COMMENT '角色级别(1-100)：用于行政控制，不可操作级别>=自己的角色',
  `data_scope` tinyint(4) DEFAULT '1' COMMENT '数据范围: 1全部, 2本部门及下属, 3本部门, 4仅本人, 5自定义',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `sort` int(11) DEFAULT '100',
  `tenant_id` bigint(20) unsigned NOT NULL DEFAULT '0' COMMENT '所属租户ID，0表示系统级',
  `status` tinyint(1) DEFAULT '1' COMMENT '状态: 1启用, 0禁用',
  `created_by` int(11) DEFAULT NULL COMMENT '创建者',
  `updated_by` int(11) DEFAULT NULL COMMENT '更新者',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=205 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='角色信息表';

-- ----------------------------
-- Records of sa_system_role
-- ----------------------------
INSERT INTO `sa_system_role` VALUES ('1', '0', '超级管理员', 'super_admin', '100', '1', '系统维护者，拥有所有权限', '100', '1', '1', '1', '1', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null);
INSERT INTO `sa_system_role` VALUES ('2', '0', '集团总裁', 'ceo', '1', '5', '查看全集团数据11', '100', '1', '1', '1', '1', '2026-01-01 00:00:00', '2026-06-23 18:00:58', null);
INSERT INTO `sa_system_role` VALUES ('3', '0', 'BG总裁', 'bg_president', '1', '2', '', '100', '1', '1', '1', '1', '2026-01-01 00:00:00', '2026-03-22 18:19:47', null);
INSERT INTO `sa_system_role` VALUES ('4', '0', '部门总经理1', 'gm', '60', '2', '', '100', '1', '1', '1', '1', '2026-01-01 00:00:00', '2026-03-22 12:48:24', null);
INSERT INTO `sa_system_role` VALUES ('5', '0', '组长', 'team_leader', '30', '3', '', '100', '1', '1', '1', '1', '2026-01-01 00:00:00', '2026-03-21 23:24:29', null);
INSERT INTO `sa_system_role` VALUES ('6', '0', '普通员工', 'staff', '10', '6', '自定义部门权限', '100', '1', '1', '1', '1', '2026-01-01 00:00:00', '2026-04-25 09:25:14', null);
INSERT INTO `sa_system_role` VALUES ('7', '0', '111', '11', '1', '1', '11', '100', '1', '1', '1', '1', '2026-03-22 20:38:38', '2026-03-22 20:38:41', '2026-03-22 20:38:41');
INSERT INTO `sa_system_role` VALUES ('8', '0', 'ad', 'dddd', '1', '6', '啊大大、', '100', '1', '1', '1', '1', '2026-03-27 21:45:30', '2026-06-21 19:31:00', null);
INSERT INTO `sa_system_role` VALUES ('204', '0', '集团CEO', 'JTCEO', '1', '1', '222CEO', '100', '2', '1', '1', '1', '2026-04-24 21:46:40', '2026-06-21 19:23:15', null);

-- ----------------------------
-- Table structure for `sa_system_role_dept`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_role_dept`;
CREATE TABLE `sa_system_role_dept` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `role_id` bigint(20) unsigned NOT NULL,
  `dept_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='角色部门关联表';

-- ----------------------------
-- Records of sa_system_role_dept
-- ----------------------------
INSERT INTO `sa_system_role_dept` VALUES ('19', '6', '2');
INSERT INTO `sa_system_role_dept` VALUES ('20', '6', '10');
INSERT INTO `sa_system_role_dept` VALUES ('21', '6', '101');
INSERT INTO `sa_system_role_dept` VALUES ('24', '8', '10');
INSERT INTO `sa_system_role_dept` VALUES ('25', '8', '101');

-- ----------------------------
-- Table structure for `sa_system_role_menu`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_role_menu`;
CREATE TABLE `sa_system_role_menu` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `role_id` bigint(20) unsigned NOT NULL,
  `menu_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=549 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='角色菜单关联表';

-- ----------------------------
-- Records of sa_system_role_menu
-- ----------------------------
INSERT INTO `sa_system_role_menu` VALUES ('322', '3', '1');
INSERT INTO `sa_system_role_menu` VALUES ('323', '3', '2');
INSERT INTO `sa_system_role_menu` VALUES ('324', '3', '74');
INSERT INTO `sa_system_role_menu` VALUES ('325', '3', '21');
INSERT INTO `sa_system_role_menu` VALUES ('326', '3', '93');
INSERT INTO `sa_system_role_menu` VALUES ('327', '3', '94');
INSERT INTO `sa_system_role_menu` VALUES ('402', '204', '10');
INSERT INTO `sa_system_role_menu` VALUES ('403', '204', '15');
INSERT INTO `sa_system_role_menu` VALUES ('404', '204', '64');
INSERT INTO `sa_system_role_menu` VALUES ('405', '204', '65');
INSERT INTO `sa_system_role_menu` VALUES ('406', '204', '16');
INSERT INTO `sa_system_role_menu` VALUES ('407', '204', '66');
INSERT INTO `sa_system_role_menu` VALUES ('408', '204', '67');
INSERT INTO `sa_system_role_menu` VALUES ('409', '204', '17');
INSERT INTO `sa_system_role_menu` VALUES ('410', '204', '68');
INSERT INTO `sa_system_role_menu` VALUES ('411', '204', '69');
INSERT INTO `sa_system_role_menu` VALUES ('412', '204', '11');
INSERT INTO `sa_system_role_menu` VALUES ('413', '204', '72');
INSERT INTO `sa_system_role_menu` VALUES ('414', '204', '73');
INSERT INTO `sa_system_role_menu` VALUES ('415', '204', '70');
INSERT INTO `sa_system_role_menu` VALUES ('416', '204', '71');
INSERT INTO `sa_system_role_menu` VALUES ('417', '204', '12');
INSERT INTO `sa_system_role_menu` VALUES ('418', '204', '56');
INSERT INTO `sa_system_role_menu` VALUES ('419', '204', '57');
INSERT INTO `sa_system_role_menu` VALUES ('420', '204', '13');
INSERT INTO `sa_system_role_menu` VALUES ('421', '204', '58');
INSERT INTO `sa_system_role_menu` VALUES ('422', '204', '59');
INSERT INTO `sa_system_role_menu` VALUES ('423', '204', '14');
INSERT INTO `sa_system_role_menu` VALUES ('424', '204', '60');
INSERT INTO `sa_system_role_menu` VALUES ('425', '204', '61');
INSERT INTO `sa_system_role_menu` VALUES ('426', '204', '62');
INSERT INTO `sa_system_role_menu` VALUES ('427', '204', '63');
INSERT INTO `sa_system_role_menu` VALUES ('428', '204', '104');
INSERT INTO `sa_system_role_menu` VALUES ('429', '204', '105');
INSERT INTO `sa_system_role_menu` VALUES ('430', '204', '106');
INSERT INTO `sa_system_role_menu` VALUES ('431', '6', '105');
INSERT INTO `sa_system_role_menu` VALUES ('432', '6', '106');
INSERT INTO `sa_system_role_menu` VALUES ('497', '2', '2');
INSERT INTO `sa_system_role_menu` VALUES ('498', '2', '1');
INSERT INTO `sa_system_role_menu` VALUES ('499', '2', '74');
INSERT INTO `sa_system_role_menu` VALUES ('500', '2', '21');
INSERT INTO `sa_system_role_menu` VALUES ('501', '2', '105');
INSERT INTO `sa_system_role_menu` VALUES ('502', '2', '106');
INSERT INTO `sa_system_role_menu` VALUES ('503', '204', '1');
INSERT INTO `sa_system_role_menu` VALUES ('504', '204', '2');
INSERT INTO `sa_system_role_menu` VALUES ('505', '204', '74');
INSERT INTO `sa_system_role_menu` VALUES ('506', '204', '21');
INSERT INTO `sa_system_role_menu` VALUES ('507', '204', '93');
INSERT INTO `sa_system_role_menu` VALUES ('508', '204', '94');
INSERT INTO `sa_system_role_menu` VALUES ('509', '204', '80');
INSERT INTO `sa_system_role_menu` VALUES ('510', '204', '81');
INSERT INTO `sa_system_role_menu` VALUES ('511', '204', '86');
INSERT INTO `sa_system_role_menu` VALUES ('512', '204', '87');
INSERT INTO `sa_system_role_menu` VALUES ('513', '204', '82');
INSERT INTO `sa_system_role_menu` VALUES ('514', '204', '83');
INSERT INTO `sa_system_role_menu` VALUES ('515', '204', '84');
INSERT INTO `sa_system_role_menu` VALUES ('516', '204', '85');
INSERT INTO `sa_system_role_menu` VALUES ('517', '204', '105');
INSERT INTO `sa_system_role_menu` VALUES ('518', '204', '106');
INSERT INTO `sa_system_role_menu` VALUES ('519', '2', '200');
INSERT INTO `sa_system_role_menu` VALUES ('520', '2', '201');
INSERT INTO `sa_system_role_menu` VALUES ('521', '2', '202');
INSERT INTO `sa_system_role_menu` VALUES ('522', '2', '203');
INSERT INTO `sa_system_role_menu` VALUES ('523', '2', '204');
INSERT INTO `sa_system_role_menu` VALUES ('524', '2', '205');
INSERT INTO `sa_system_role_menu` VALUES ('525', '2', '206');
INSERT INTO `sa_system_role_menu` VALUES ('526', '2', '207');
INSERT INTO `sa_system_role_menu` VALUES ('527', '2', '208');
INSERT INTO `sa_system_role_menu` VALUES ('528', '2', '209');
INSERT INTO `sa_system_role_menu` VALUES ('529', '2', '300');
INSERT INTO `sa_system_role_menu` VALUES ('530', '2', '301');
INSERT INTO `sa_system_role_menu` VALUES ('531', '2', '302');
INSERT INTO `sa_system_role_menu` VALUES ('532', '2', '303');
INSERT INTO `sa_system_role_menu` VALUES ('533', '2', '304');
INSERT INTO `sa_system_role_menu` VALUES ('534', '2', '305');
INSERT INTO `sa_system_role_menu` VALUES ('535', '2', '306');
INSERT INTO `sa_system_role_menu` VALUES ('536', '2', '307');
INSERT INTO `sa_system_role_menu` VALUES ('537', '2', '308');
INSERT INTO `sa_system_role_menu` VALUES ('538', '2', '309');
INSERT INTO `sa_system_role_menu` VALUES ('539', '2', '310');
INSERT INTO `sa_system_role_menu` VALUES ('540', '2', '311');
INSERT INTO `sa_system_role_menu` VALUES ('541', '2', '312');
INSERT INTO `sa_system_role_menu` VALUES ('542', '2', '313');
INSERT INTO `sa_system_role_menu` VALUES ('543', '2', '314');
INSERT INTO `sa_system_role_menu` VALUES ('544', '2', '315');
INSERT INTO `sa_system_role_menu` VALUES ('545', '2', '316');
INSERT INTO `sa_system_role_menu` VALUES ('546', '2', '317');
INSERT INTO `sa_system_role_menu` VALUES ('547', '2', '318');
INSERT INTO `sa_system_role_menu` VALUES ('548', '2', '319');

-- ----------------------------
-- Table structure for `sa_system_tenant`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_tenant`;
CREATE TABLE `sa_system_tenant` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '租户ID',
  `tenant_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户名称',
  `tenant_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户编码（唯一）',
  `contact_name` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '联系人姓名',
  `contact_phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '联系人电话',
  `contact_email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '联系人邮箱',
  `address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '租户地址',
  `logo_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '租户Logo URL',
  `status` tinyint(3) unsigned NOT NULL DEFAULT '1' COMMENT '状态：0=禁用 1=启用',
  `expire_time` timestamp NULL DEFAULT NULL COMMENT '过期时间',
  `max_users` int(10) unsigned NOT NULL DEFAULT '0' COMMENT '最大用户数，0=无限制',
  `max_depts` int(10) unsigned NOT NULL DEFAULT '0' COMMENT '最大部门数，0=无限制',
  `max_roles` int(10) unsigned NOT NULL DEFAULT '0' COMMENT '最大角色数，0=无限制',
  `remark` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '备注',
  `created_by` bigint(20) unsigned NOT NULL DEFAULT '0' COMMENT '创建人ID',
  `updated_by` bigint(20) unsigned NOT NULL DEFAULT '0' COMMENT '更新人ID',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租户表';

-- ----------------------------
-- Records of sa_system_tenant
-- ----------------------------
INSERT INTO `sa_system_tenant` VALUES ('1', '租户1', 'Tenant1', '张三丰', '88888888', 'admin@qq.com', '测试地址', '', '1', null, '0', '0', '0', '', '0', '100', null, '2026-04-22 22:34:39', null);
INSERT INTO `sa_system_tenant` VALUES ('2', '租户2', '88888', null, null, null, null, null, '1', null, '0', '0', '0', null, '1', '100', '2026-04-06 22:21:00', '2026-04-22 22:34:31', null);
INSERT INTO `sa_system_tenant` VALUES ('3', '租户3', '8888', null, null, null, null, null, '0', null, '0', '0', '0', null, '1', '1', '2026-04-06 22:31:31', '2026-04-19 00:23:16', null);
INSERT INTO `sa_system_tenant` VALUES ('10', '单租户测试', 'tenant_10', null, null, null, null, null, '1', null, '0', '0', '0', null, '0', '0', '2026-04-24 12:40:17', '2026-04-24 12:40:17', null);

-- ----------------------------
-- Table structure for `sa_system_user`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_user`;
CREATE TABLE `sa_system_user` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `username` varchar(64) NOT NULL COMMENT '用户账号',
  `password` varchar(255) NOT NULL COMMENT '用户登录密码',
  `realname` varchar(64) DEFAULT NULL COMMENT '用户昵称',
  `gender` varchar(10) DEFAULT '0' COMMENT '性别',
  `avatar` varchar(255) NOT NULL DEFAULT '' COMMENT '头像地址',
  `email` varchar(128) DEFAULT NULL COMMENT '邮箱',
  `phone` varchar(20) DEFAULT NULL COMMENT '手机号',
  `signed` varchar(255) DEFAULT NULL COMMENT '个性签名',
  `dashboard` varchar(255) DEFAULT 'work' COMMENT '工作台',
  `dept_id` bigint(20) unsigned DEFAULT NULL COMMENT '主归属部门',
  `is_super` tinyint(1) DEFAULT '0' COMMENT '是否超级管理员: 1是(跳过权限检查), 0否',
  `status` tinyint(1) DEFAULT '1' COMMENT '状态: 1启用, 0禁用',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `login_time` timestamp NULL DEFAULT NULL COMMENT '最后登录时间',
  `login_ip` varchar(45) DEFAULT NULL COMMENT '最后登录IP',
  `created_by` int(11) DEFAULT NULL COMMENT '创建者',
  `updated_by` int(11) DEFAULT NULL COMMENT '更新者',
  `create_time` datetime(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `update_time` datetime(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '修改时间',
  `delete_time` datetime(6) DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `IDX_ac6e674d8be83ea453e356bd78` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=124 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='用户信息表';

-- ----------------------------
-- Records of sa_system_user
-- ----------------------------
INSERT INTO `sa_system_user` VALUES ('1', 'admin', '$2y$10$wnixh48uDnaW/6D9EygDd.OHJK0vQY/4nHaTjMKBCVDBP2NiTatqS', '冷月如霜', '1', 'https://img1.ali213.net/glpic/2025/02/05/584_2025020554520608.png', 'fssphp@admin.com', '15888888888', 'FSSADMIN是兼具设计美学与高效开发的后台系统!11', 'statistics', '1', '1', '1', null, '2026-06-30 22:56:45', '127.0.0.1', '1', '1', '2026-01-01 00:00:00.000000', '2026-06-30 22:56:44.588000', null);
INSERT INTO `sa_system_user` VALUES ('2', 'martin', '$2y$10$L3sEraye7Q8XPenbx5M8JOW6j9BP1B/E2Iox6o6mVYB1MjML942N2', '刘炽平', '1', 'https://static.wandongli.com/static/pc/images/png.png', 'martin1@163.com', '15888888888', null, 'work', '5', '0', '1', '', '2026-05-03 23:23:33', '127.0.0.1', '1', '1', '2026-01-01 00:00:00.000000', '2026-06-19 10:59:54.316000', null);
INSERT INTO `sa_system_user` VALUES ('3', 'allen', '$2y$10$H8d7riOjOiwPSopguEQ1fuKZz.fA0A54OvuzTqgJlbG1N3uOxEwM.', '张小龙', '1', 'https://static.wandongli.com/static/pc/images/png.png', '', '15888888888', null, 'work', '10', '0', '1', '', null, null, '1', '1', '2026-01-01 00:00:00.000000', '2026-03-21 23:24:03.000000', null);
INSERT INTO `sa_system_user` VALUES ('4', 'mark', '$2y$10$sY/4StKVV.N/8Ock8J8kdeIOK4jS4tAUoYjkzvB8Tzy0fLh.wA2KS', '任宇昕', '2', 'https://static.wandongli.com/static/pc/images/png.png', null, '15888888888', null, 'work', '11', '0', '1', null, null, null, '1', '1', '2026-01-01 00:00:00.000000', '2026-03-21 23:20:40.000000', null);
INSERT INTO `sa_system_user` VALUES ('5', 'dowson', '$2y$10$sY/4StKVV.N/8Ock8J8kdeIOK4jS4tAUoYjkzvB8Tzy0fLh.wA2KS', '汤道生', '1', 'https://static.wandongli.com/static/pc/images/png.png', null, '15888888888', null, 'work', '12', '0', '1', null, null, null, '1', '1', '2026-01-01 00:00:00.000000', '2026-01-01 00:00:00.000000', null);
INSERT INTO `sa_system_user` VALUES ('10', 'timi_boss', '$2y$10$a9S4v4i6ZpDEJQ1qgWsWnuifsq4dgGdVFZDearta9.mOz.IpcBWzK', '姚晓光', '1', 'https://static.wandongli.com/static/pc/images/png.png', '8888@qq.com', '15888888888', null, 'work', '111', '1', '1', '', '2026-05-15 07:51:18', '127.0.0.1', '1', '1', '2026-01-01 00:00:00.000000', '2026-06-21 21:13:06.910000', null);
INSERT INTO `sa_system_user` VALUES ('100', 'devwang', '$2y$10$vbnOKDkbm9hIEd8JWXITpO5pcRtl/KTBqswojEkuaP7vdGB5tPzES', '王程序员', '1', '', '888888@qq.com', '15888888888', null, 'work', '12', '0', '1', '1', '2026-06-24 20:49:24', '127.0.0.1', '1', '1', '2026-01-01 00:00:00.000000', '2026-06-24 20:49:24.030000', null);
INSERT INTO `sa_system_user` VALUES ('101', 'devli', '$2y$10$2fuWT7n6E8kyG357FbNrouRyRvulmTYXpmFE71bHOH3PQAgpPItW.', '李策划', '1', '/uploads/2026/03/28/69c7a3a67d5e50.12092222.png', null, '15888881234', null, 'work', '2', '0', '1', '1111', null, null, '1', '1', '2026-01-01 00:00:00.000000', '2026-03-28 17:50:57.000000', null);
INSERT INTO `sa_system_user` VALUES ('102', 'test', '$2y$10$wnixh48uDnaW/6D9EygDd.OHJK0vQY/4nHaTjMKBCVDBP2NiTatqS', 'admin1', '1', '', '', '13512344567', null, 'work', '2', '0', '1', '', null, null, null, null, '2026-03-22 21:42:54.000000', '2026-03-22 21:54:46.000000', '2026-03-22 21:54:46.000000');
INSERT INTO `sa_system_user` VALUES ('104', 'test2', '$2y$10$AQjV0REYZumtiT4sDpmKtODXLQtIL.9ralALUFKZGvrxKWcpHS9ii', 'test2', '2', 'http://127.0.0.1:8000/uploads/2026/03/28/69c7a3b2058589.44968839.webp', '', '', null, 'work', '2', '0', '1', '', '2026-04-22 22:07:17', '127.0.0.1', null, '1', '2026-03-22 21:58:24.000000', '2026-05-16 17:13:50.000000', null);
INSERT INTO `sa_system_user` VALUES ('105', 'test3', '$2y$10$LRECF.G/1CS14NMujqelpucMJ4kQX.OuLdk5D5DT3EjgS8.CnePHy', 'test3', '1', '/uploads/2026/03/28/69c7a3a9e6c335.87540530.png', '', '', null, 'work', '101', '0', '1', '1', null, null, null, '1', '2026-03-25 21:58:53.000000', '2026-03-28 17:50:39.000000', null);
INSERT INTO `sa_system_user` VALUES ('106', 'test3test3', '$2y$10$lDmHlmRsw/pPF4Yd/HcP7eE0xGpkqsNVVhC4TrAz31K7XckECcaQu', 'test3test3', '2', '/uploads/2026/03/28/69c7a3acd6b581.21163358.png', '', '', null, 'work', '102', '0', '1', '', null, null, null, '1', '2026-03-25 21:59:21.000000', '2026-03-28 17:50:29.000000', null);
INSERT INTO `sa_system_user` VALUES ('116', 'testtesttest', '$2y$10$0GmhEW3QFGv.pHltuKQIUuNKAaACDiDARMt3QLjRVZ0y.iolKIDyK', 'testtest', '1', '/uploads/2026/03/28/69c7a3b2058589.44968839.webp', '', '', null, 'work', '2', '0', '1', '', null, null, '1', '1', '2026-03-27 21:12:03.000000', '2026-03-28 17:49:22.000000', null);
INSERT INTO `sa_system_user` VALUES ('117', 'test1311', '$2y$10$wxvQ16EIyNTrarFQ3fM1Euvd1rzgeZPbEgMsRbpFdiWxC3pX9UOpW', '11231', '2', '', '', '', null, 'work', '2', '0', '1', '', null, null, '1', '1', '2026-03-27 21:29:06.000000', '2026-03-28 23:09:35.000000', '2026-03-28 23:09:35.000000');
INSERT INTO `sa_system_user` VALUES ('118', 'ddd', '$2y$10$GA/p/o7CH5FiJJxPGh6pDuAMhGNUoKYiSWBRhQwdB30aacnVwqC.W', 'ddd', '', '/uploads/2026/03/28/69c7a3b48aab47.53936592.png', '', '', null, 'statistics', '1', '0', '1', '', null, null, '1', '1', '2026-03-27 22:32:06.000000', '2026-03-28 19:07:29.000000', null);
INSERT INTO `sa_system_user` VALUES ('119', 'zhangsanfeng', '$2y$10$JH3nWeQNuRYPvmRH.Wouauaxme3pmcdjJFjdoJ0bZxI6oO2kJyLma', '张三丰', '1', '/uploads/2026/03/28/69c7a3acd6b581.21163358.png', '', '', null, 'work', null, '0', '1', '', null, null, '1', '1', '2026-05-05 18:02:28.000000', '2026-05-05 18:02:28.000000', null);
INSERT INTO `sa_system_user` VALUES ('120', 'qiaofeng', '$2y$10$0G0vZyI3r69vFZtlMfXjx.8fGuDM.5zaUAujf.DxetToTSPwRPNbK', '乔峰', '1', '/uploads/2026/03/28/69c7a3a83f9f14.20042528.png', '', '', null, 'work', null, '0', '1', '', null, null, '1', '1', '2026-05-05 18:04:51.000000', '2026-05-05 18:04:51.000000', null);
INSERT INTO `sa_system_user` VALUES ('121', 'yangguo', '$2y$10$0ruAFh29.cyxm6vTubHHcOP6xanbRTXp86nUZMyeA7Xp2M/1XLDri', '杨过', '1', '/uploads/2026/03/28/69c7a3a1cae578.20110121.png', '', '', null, 'work', null, '0', '1', '', null, null, '1', '1', '2026-05-05 18:06:55.000000', '2026-05-05 18:06:55.000000', null);
INSERT INTO `sa_system_user` VALUES ('122', 'xiaolongnv', '$2y$10$nKMfot7pTjwYguTFq.4bz.rLWGPKYRr/jBJms3uY4qzm9e6ClCZIC', '小龙女', '2', '', '', '', null, 'work', null, '0', '1', '', null, null, '1', '1', '2026-05-05 18:07:27.000000', '2026-05-07 23:37:58.000000', null);
INSERT INTO `sa_system_user` VALUES ('123', 'guojing', '$2y$10$/CnyvA4nkw.Nx0SLTobdWOSgn1qOO6TEge6LELcz4sPNXc/.CyjvS', '郭靖', '1', '', '', '', null, 'work', null, '0', '1', '', null, null, '1', '1', '2026-05-05 18:08:14.000000', '2026-05-07 23:37:46.000000', null);

-- ----------------------------
-- Table structure for `sa_system_user_dept`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_user_dept`;
CREATE TABLE `sa_system_user_dept` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `tenant_id` bigint(20) unsigned NOT NULL COMMENT '租户ID',
  `user_id` bigint(20) unsigned NOT NULL COMMENT '用户ID',
  `dept_id` bigint(20) unsigned NOT NULL COMMENT '部门ID',
  `created_by` bigint(20) unsigned DEFAULT NULL COMMENT '创建人ID',
  `updated_by` bigint(20) unsigned DEFAULT NULL COMMENT '更新人ID',
  `create_time` timestamp NULL DEFAULT NULL COMMENT '创建时间',
  `update_time` timestamp NULL DEFAULT NULL COMMENT '更新时间',
  `delete_time` datetime(6) DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=15 DEFAULT CHARSET=utf8 COMMENT='用户部门关联表';

-- ----------------------------
-- Records of sa_system_user_dept
-- ----------------------------
INSERT INTO `sa_system_user_dept` VALUES ('5', '2', '100', '129', '1', '1', null, '2026-04-24 21:47:04', null);
INSERT INTO `sa_system_user_dept` VALUES ('6', '1', '100', '12', '1', '1', '2026-04-24 21:52:00', '2026-04-24 21:52:24', null);
INSERT INTO `sa_system_user_dept` VALUES ('7', '1', '1', '1', '1', '1', null, null, null);
INSERT INTO `sa_system_user_dept` VALUES ('8', '1', '10', '1', '1', '1', '2026-04-25 09:26:06', '2026-04-25 09:26:06', null);
INSERT INTO `sa_system_user_dept` VALUES ('9', '1', '119', '5', '1', '1', '2026-05-05 18:02:28', '2026-05-05 18:02:28', null);
INSERT INTO `sa_system_user_dept` VALUES ('10', '1', '120', '2', '1', '1', '2026-05-05 18:04:51', '2026-05-05 18:04:51', null);
INSERT INTO `sa_system_user_dept` VALUES ('11', '1', '121', '101', '1', '1', '2026-05-05 18:06:55', '2026-05-05 18:06:55', null);
INSERT INTO `sa_system_user_dept` VALUES ('12', '1', '122', '102', '1', '1', '2026-05-05 18:07:27', '2026-05-05 18:07:27', null);
INSERT INTO `sa_system_user_dept` VALUES ('13', '1', '123', '5', '1', '1', '2026-05-05 18:08:14', '2026-05-05 18:08:14', null);
INSERT INTO `sa_system_user_dept` VALUES ('14', '1', '104', '12', '1', '1', '2026-05-16 17:13:51', '2026-05-16 17:13:51', null);

-- ----------------------------
-- Table structure for `sa_system_user_menu`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_user_menu`;
CREATE TABLE `sa_system_user_menu` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` bigint(20) unsigned NOT NULL COMMENT '用户ID',
  `menu_id` bigint(20) unsigned NOT NULL COMMENT '菜单ID',
  `tenant_id` bigint(20) unsigned DEFAULT '0' COMMENT '租户ID',
  `created_by` bigint(20) unsigned DEFAULT '0' COMMENT '创建人ID',
  `updated_by` bigint(20) unsigned DEFAULT '0' COMMENT '更新人ID',
  `status` tinyint(3) unsigned NOT NULL DEFAULT '1' COMMENT '状态：0=禁用 1=启用',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  `is_show` tinyint(4) NOT NULL DEFAULT '1' COMMENT '是否显示',
  `is_create` tinyint(4) NOT NULL DEFAULT '1' COMMENT '是否新增',
  `is_update` tinyint(4) NOT NULL DEFAULT '1' COMMENT '是否修改',
  `is_delete` tinyint(4) NOT NULL DEFAULT '1' COMMENT '是否删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_menu` (`user_id`,`menu_id`,`tenant_id`) USING BTREE,
  KEY `idx_tenant_id` (`tenant_id`)
) ENGINE=InnoDB AUTO_INCREMENT=848 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户菜单权限表';

-- ----------------------------
-- Records of sa_system_user_menu
-- ----------------------------
INSERT INTO `sa_system_user_menu` VALUES ('49', '118', '2', '0', '0', '0', '1', '2026-03-28 23:39:06', '2026-03-28 23:39:06', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('50', '118', '74', '0', '0', '0', '1', '2026-03-28 23:39:06', '2026-03-28 23:39:06', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('51', '118', '85', '0', '0', '0', '1', '2026-03-28 23:39:06', '2026-03-28 23:39:06', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('52', '118', '1', '0', '0', '0', '1', '2026-03-28 23:39:06', '2026-03-28 23:39:06', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('53', '118', '80', '0', '0', '0', '1', '2026-03-28 23:39:06', '2026-03-28 23:39:06', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('54', '118', '82', '0', '0', '0', '1', '2026-03-28 23:39:06', '2026-03-28 23:39:06', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('229', '2', '1', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('230', '2', '2', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('231', '2', '74', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('232', '2', '21', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('233', '2', '93', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('234', '2', '94', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('235', '2', '3', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('236', '2', '4', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('237', '2', '20', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('238', '2', '22', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('239', '2', '23', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('240', '2', '24', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('241', '2', '25', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('242', '2', '26', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('243', '2', '27', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('244', '2', '28', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('245', '2', '5', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('246', '2', '29', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('247', '2', '30', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('248', '2', '31', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('249', '2', '32', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('250', '2', '33', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('251', '2', '97', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('252', '2', '6', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('253', '2', '34', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('254', '2', '35', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('255', '2', '36', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('256', '2', '37', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('257', '2', '38', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('258', '2', '39', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('259', '2', '7', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('260', '2', '41', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('261', '2', '42', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('262', '2', '43', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('263', '2', '44', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('264', '2', '45', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('265', '2', '46', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('266', '2', '47', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('267', '2', '8', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('268', '2', '48', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('269', '2', '49', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('270', '2', '50', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('271', '2', '51', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('272', '2', '52', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('273', '2', '18', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('274', '2', '53', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('275', '2', '54', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('276', '2', '55', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('277', '2', '98', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('278', '2', '99', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('279', '2', '100', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('280', '2', '101', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('281', '2', '102', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('282', '2', '103', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('283', '2', '10', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('284', '2', '15', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('285', '2', '64', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('286', '2', '65', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('287', '2', '16', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('288', '2', '66', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('289', '2', '67', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('290', '2', '17', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('291', '2', '68', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('292', '2', '69', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('293', '2', '11', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('294', '2', '72', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('295', '2', '73', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('296', '2', '70', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('297', '2', '71', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('298', '2', '12', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('299', '2', '56', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('300', '2', '57', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('301', '2', '13', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('302', '2', '58', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('303', '2', '59', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('304', '2', '14', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('305', '2', '60', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('306', '2', '61', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('307', '2', '62', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('308', '2', '63', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('309', '2', '104', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('310', '2', '80', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('311', '2', '81', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('312', '2', '86', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('313', '2', '87', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('314', '2', '82', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('315', '2', '83', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('316', '2', '84', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('317', '2', '85', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('318', '2', '88', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('319', '2', '105', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('320', '2', '106', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('321', '2', '138', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('322', '2', '139', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('323', '2', '151', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('324', '2', '152', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('325', '2', '153', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('326', '2', '140', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('327', '2', '141', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('328', '2', '160', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('329', '2', '161', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('330', '2', '162', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('331', '2', '163', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('332', '2', '142', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('333', '2', '164', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('334', '2', '165', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('335', '2', '143', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('336', '2', '166', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('337', '2', '144', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('338', '2', '145', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('339', '2', '146', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('340', '2', '147', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('341', '2', '148', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('342', '2', '149', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('343', '2', '150', '0', '0', '0', '1', '2026-05-03 23:23:18', '2026-05-03 23:23:18', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('696', '10', '2', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('697', '10', '1', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('698', '10', '74', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('699', '10', '21', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('700', '10', '93', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('701', '10', '94', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('702', '10', '3', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('703', '10', '4', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('704', '10', '20', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('705', '10', '22', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('706', '10', '23', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('707', '10', '24', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('708', '10', '25', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('709', '10', '26', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('710', '10', '27', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('711', '10', '28', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('712', '10', '5', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('713', '10', '29', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('714', '10', '30', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('715', '10', '31', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('716', '10', '32', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('717', '10', '33', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('718', '10', '97', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('719', '10', '6', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('720', '10', '34', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('721', '10', '35', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('722', '10', '36', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('723', '10', '37', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('724', '10', '38', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('725', '10', '39', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('726', '10', '7', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('727', '10', '41', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('728', '10', '42', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('729', '10', '43', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('730', '10', '44', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('731', '10', '45', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('732', '10', '46', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('733', '10', '47', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('734', '10', '8', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('735', '10', '48', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('736', '10', '49', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('737', '10', '50', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('738', '10', '51', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('739', '10', '52', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('740', '10', '18', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('741', '10', '53', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('742', '10', '54', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('743', '10', '55', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('744', '10', '98', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('745', '10', '99', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('746', '10', '100', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('747', '10', '101', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('748', '10', '102', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('749', '10', '103', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('750', '10', '138', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('751', '10', '172', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('752', '10', '141', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('753', '10', '160', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('754', '10', '161', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('755', '10', '162', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('756', '10', '163', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('757', '10', '142', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('758', '10', '164', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('759', '10', '165', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('760', '10', '168', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('761', '10', '169', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('762', '10', '170', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('763', '10', '143', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('764', '10', '166', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('765', '10', '167', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('766', '10', '171', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('767', '10', '179', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('768', '10', '180', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('769', '10', '181', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('770', '10', '144', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('771', '10', '145', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('772', '10', '146', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('773', '10', '147', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('774', '10', '148', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('775', '10', '149', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('776', '10', '182', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('777', '10', '150', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('778', '10', '110', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('779', '10', '139', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('780', '10', '151', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('781', '10', '152', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('782', '10', '153', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('783', '10', '140', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('784', '10', '174', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('785', '10', '175', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('786', '10', '176', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('787', '10', '177', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('788', '10', '178', '0', '0', '0', '1', '2026-05-15 18:40:03', '2026-05-15 18:40:03', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('841', '100', '2', '2', '0', '0', '1', '2026-06-21 21:13:55', '2026-06-21 21:13:55', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('842', '100', '1', '2', '0', '0', '1', '2026-06-21 21:13:55', '2026-06-21 21:13:55', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('843', '100', '74', '2', '0', '0', '1', '2026-06-21 21:13:55', '2026-06-21 21:13:55', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('844', '100', '21', '2', '0', '0', '1', '2026-06-21 21:13:55', '2026-06-21 21:13:55', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('845', '100', '93', '2', '0', '0', '1', '2026-06-21 21:13:55', '2026-06-21 21:13:55', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('846', '100', '94', '2', '0', '0', '1', '2026-06-21 21:13:55', '2026-06-21 21:13:55', null, '1', '1', '1', '1');
INSERT INTO `sa_system_user_menu` VALUES ('847', '100', '173', '2', '0', '0', '1', '2026-06-21 21:13:55', '2026-06-21 21:13:55', null, '1', '1', '1', '1');

-- ----------------------------
-- Table structure for `sa_system_user_post`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_user_post`;
CREATE TABLE `sa_system_user_post` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id` bigint(20) unsigned NOT NULL COMMENT '用户主键',
  `post_id` bigint(20) unsigned NOT NULL COMMENT '岗位主键',
  `status` tinyint(3) unsigned NOT NULL DEFAULT '1' COMMENT '状态：0=禁用 1=启用',
  `created_by` bigint(20) unsigned NOT NULL DEFAULT '0' COMMENT '创建人ID',
  `updated_by` bigint(20) unsigned NOT NULL DEFAULT '0' COMMENT '更新人ID',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  `tenant_id` bigint(20) unsigned NOT NULL DEFAULT '0' COMMENT '租户上下文ID',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=55 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='用户岗位关联表';

-- ----------------------------
-- Records of sa_system_user_post
-- ----------------------------
INSERT INTO `sa_system_user_post` VALUES ('1', '1', '2', '1', '0', '0', null, null, null, '1');
INSERT INTO `sa_system_user_post` VALUES ('4', '1', '1', '1', '0', '0', null, null, null, '1');
INSERT INTO `sa_system_user_post` VALUES ('32', '116', '1', '1', '0', '0', null, null, null, '1');
INSERT INTO `sa_system_user_post` VALUES ('33', '106', '2', '1', '0', '0', null, null, null, '1');
INSERT INTO `sa_system_user_post` VALUES ('34', '105', '1', '1', '0', '0', null, null, null, '1');
INSERT INTO `sa_system_user_post` VALUES ('36', '101', '1', '1', '0', '0', null, null, null, '1');
INSERT INTO `sa_system_user_post` VALUES ('50', '100', '1', '1', '0', '0', null, null, null, '1');
INSERT INTO `sa_system_user_post` VALUES ('51', '104', '1', '1', '0', '0', null, null, null, '1');
INSERT INTO `sa_system_user_post` VALUES ('53', '2', '2', '1', '1', '1', '2026-06-19 10:59:54', '2026-06-19 10:59:54', null, '1');
INSERT INTO `sa_system_user_post` VALUES ('54', '10', '1', '1', '0', '0', null, null, null, '1');

-- ----------------------------
-- Table structure for `sa_system_user_role`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_user_role`;
CREATE TABLE `sa_system_user_role` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `role_id` bigint(20) unsigned NOT NULL,
  `status` tinyint(3) unsigned NOT NULL DEFAULT '1' COMMENT '状态：0=禁用 1=启用',
  `tenant_id` bigint(20) unsigned NOT NULL DEFAULT '0' COMMENT '租户上下文ID',
  `created_by` int(11) DEFAULT NULL COMMENT '创建者',
  `updated_by` int(11) DEFAULT NULL COMMENT '更新者',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=87 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='用户角色关联表';

-- ----------------------------
-- Records of sa_system_user_role
-- ----------------------------
INSERT INTO `sa_system_user_role` VALUES ('1', '1', '1', '1', '1', null, null, null, null, null);
INSERT INTO `sa_system_user_role` VALUES ('12', '1', '2', '1', '1', null, null, null, null, null);
INSERT INTO `sa_system_user_role` VALUES ('43', '116', '8', '1', '1', '1', '1', '2026-03-28 17:49:22', '2026-03-28 17:49:22', null);
INSERT INTO `sa_system_user_role` VALUES ('44', '106', '4', '1', '1', '1', '1', '2026-03-28 17:50:29', '2026-03-28 17:50:29', null);
INSERT INTO `sa_system_user_role` VALUES ('45', '105', '2', '1', '1', '1', '1', '2026-03-28 17:50:39', '2026-03-28 17:50:39', null);
INSERT INTO `sa_system_user_role` VALUES ('47', '101', '2', '1', '1', '1', '1', '2026-03-28 17:50:57', '2026-03-28 17:50:57', null);
INSERT INTO `sa_system_user_role` VALUES ('63', '100', '204', '1', '2', '1', '1', '2026-04-24 21:47:04', '2026-04-24 21:47:04', null);
INSERT INTO `sa_system_user_role` VALUES ('73', '119', '2', '1', '1', '1', '1', '2026-05-05 18:02:28', '2026-05-05 18:02:28', null);
INSERT INTO `sa_system_user_role` VALUES ('74', '120', '3', '1', '1', '1', '1', '2026-05-05 18:04:51', '2026-05-05 18:04:51', null);
INSERT INTO `sa_system_user_role` VALUES ('75', '121', '4', '1', '1', '1', '1', '2026-05-05 18:06:55', '2026-05-05 18:06:55', null);
INSERT INTO `sa_system_user_role` VALUES ('79', '100', '2', '1', '1', '1', '1', '2026-05-07 23:30:43', '2026-05-07 23:30:43', null);
INSERT INTO `sa_system_user_role` VALUES ('81', '123', '2', '1', '1', '1', '1', '2026-05-07 23:37:46', '2026-05-07 23:37:46', null);
INSERT INTO `sa_system_user_role` VALUES ('82', '122', '3', '1', '1', '1', '1', '2026-05-07 23:37:58', '2026-05-07 23:37:58', null);
INSERT INTO `sa_system_user_role` VALUES ('83', '104', '2', '1', '1', '1', '1', '2026-05-16 17:13:50', '2026-05-16 17:13:50', null);
INSERT INTO `sa_system_user_role` VALUES ('85', '2', '2', '1', '1', '1', '1', '2026-06-19 10:59:54', '2026-06-19 10:59:54', null);
INSERT INTO `sa_system_user_role` VALUES ('86', '10', '6', '1', '1', null, null, null, null, null);

-- ----------------------------
-- Table structure for `sa_system_user_tenant`
-- ----------------------------
DROP TABLE IF EXISTS `sa_system_user_tenant`;
CREATE TABLE `sa_system_user_tenant` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` bigint(20) unsigned NOT NULL COMMENT '用户ID',
  `tenant_id` bigint(20) unsigned NOT NULL COMMENT '租户ID',
  `is_default` tinyint(3) unsigned NOT NULL DEFAULT '0' COMMENT '是否默认租户：0=否 1=是',
  `is_super` tinyint(4) NOT NULL DEFAULT '0' COMMENT '租户管理员',
  `created_by` bigint(20) unsigned NOT NULL DEFAULT '0' COMMENT '创建人ID',
  `updated_by` bigint(20) unsigned NOT NULL DEFAULT '0' COMMENT '更新人ID',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  `status` tinyint(4) NOT NULL DEFAULT '1' COMMENT '状态（1启用 0禁用）',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户租户关联表';

-- ----------------------------
-- Records of sa_system_user_tenant
-- ----------------------------
INSERT INTO `sa_system_user_tenant` VALUES ('1', '1', '1', '1', '0', '0', '1', null, '2026-06-23 20:32:36', null, '1');
INSERT INTO `sa_system_user_tenant` VALUES ('3', '104', '1', '0', '0', '1', '1', '2026-03-22 21:58:24', '2026-04-18 23:46:42', null, '1');
INSERT INTO `sa_system_user_tenant` VALUES ('5', '106', '1', '0', '0', '1', '1', '2026-03-25 21:59:21', '2026-04-19 00:12:53', null, '1');
INSERT INTO `sa_system_user_tenant` VALUES ('6', '116', '1', '0', '0', '1', '1', '2026-03-27 21:12:03', '2026-04-19 00:12:51', null, '1');
INSERT INTO `sa_system_user_tenant` VALUES ('9', '3', '3', '0', '0', '1', '1', '2026-04-06 22:31:46', '2026-04-06 22:31:46', null, '1');
INSERT INTO `sa_system_user_tenant` VALUES ('10', '100', '1', '1', '1', '1', '1', '2026-04-18 23:27:30', '2026-05-11 19:41:36', null, '1');
INSERT INTO `sa_system_user_tenant` VALUES ('11', '100', '2', '0', '1', '1', '1', '2026-04-22 22:11:29', '2026-05-11 19:41:36', null, '1');
INSERT INTO `sa_system_user_tenant` VALUES ('12', '1', '2', '0', '0', '1', '1', '2026-04-23 23:37:22', '2026-06-23 20:32:36', null, '1');
INSERT INTO `sa_system_user_tenant` VALUES ('14', '10', '1', '1', '0', '1', '1', '2026-04-25 09:23:56', '2026-05-15 07:51:40', null, '1');
INSERT INTO `sa_system_user_tenant` VALUES ('15', '10', '2', '0', '0', '1', '1', '2026-04-25 09:24:22', '2026-05-15 07:51:40', null, '1');
INSERT INTO `sa_system_user_tenant` VALUES ('16', '2', '1', '0', '0', '0', '0', null, null, null, '1');
INSERT INTO `sa_system_user_tenant` VALUES ('17', '119', '1', '1', '0', '1', '1', '2026-05-05 18:02:28', '2026-05-05 18:02:28', null, '1');
INSERT INTO `sa_system_user_tenant` VALUES ('18', '120', '1', '1', '0', '1', '1', '2026-05-05 18:04:51', '2026-05-05 18:04:51', null, '1');
INSERT INTO `sa_system_user_tenant` VALUES ('19', '121', '1', '1', '0', '1', '1', '2026-05-05 18:06:55', '2026-05-05 18:06:55', null, '1');
INSERT INTO `sa_system_user_tenant` VALUES ('20', '122', '1', '1', '0', '1', '1', '2026-05-05 18:07:27', '2026-05-05 18:07:27', null, '1');
INSERT INTO `sa_system_user_tenant` VALUES ('21', '123', '1', '1', '0', '1', '1', '2026-05-05 18:08:14', '2026-05-05 18:08:14', null, '1');

-- ----------------------------
-- Table structure for `sa_tool_generate_columns`
-- ----------------------------
DROP TABLE IF EXISTS `sa_tool_generate_columns`;
CREATE TABLE `sa_tool_generate_columns` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `table_id` int(11) unsigned DEFAULT NULL COMMENT '所属表ID',
  `column_name` varchar(200) DEFAULT NULL COMMENT '字段名称',
  `column_comment` varchar(255) DEFAULT NULL COMMENT '字段注释',
  `column_type` varchar(50) DEFAULT NULL COMMENT '字段类型',
  `is_pk` smallint(6) DEFAULT '1' COMMENT '1 非主键 2 主键',
  `is_required` smallint(6) DEFAULT '1' COMMENT '1 非必填 2 必填',
  `is_insert` smallint(6) DEFAULT '1' COMMENT '1 非插入字段 2 插入字段',
  `is_edit` smallint(6) DEFAULT '1' COMMENT '1 非编辑字段 2 编辑字段',
  `is_list` smallint(6) DEFAULT '1' COMMENT '1 非列表显示字段 2 列表显示字段',
  `is_query` smallint(6) DEFAULT '1' COMMENT '1 非查询字段 2 查询字段',
  `query_type` varchar(100) DEFAULT 'eq' COMMENT '查询方式 eq 等于, neq 不等于, gt 大于, lt 小于, like 范围',
  `dict_type` varchar(200) DEFAULT NULL COMMENT '字典类型',
  `sort` tinyint(3) unsigned DEFAULT '0' COMMENT '排序',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` int(11) DEFAULT NULL COMMENT '创建者',
  `updated_by` int(11) DEFAULT NULL COMMENT '更新者',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  `java_type` varchar(500) NOT NULL COMMENT 'JAVA类型',
  `java_field` varchar(200) NOT NULL COMMENT 'JAVA字段名',
  `is_increment` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否自增（1是）',
  `html_type` varchar(200) NOT NULL DEFAULT '' COMMENT '显示类型（文本框、文本域、下拉框、复选框、单选框、日期控件）',
  `column_default` varchar(200) DEFAULT NULL COMMENT '默认值',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=463 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='代码生成业务表字段';

-- ----------------------------
-- Records of sa_tool_generate_columns
-- ----------------------------
INSERT INTO `sa_tool_generate_columns` VALUES ('409', '2', 'id', '??', 'int(10)', '2', '1', '1', '1', '2', '1', 'eq', null, '0', null, '1', '1', '2026-03-30 23:20:55', '2026-06-19 20:30:44', null, 'String', 'id', '0', 'input', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('410', '2', 'category_id', '分类id', 'int(10)', '1', '1', '2', '2', '2', '1', 'eq', null, '1', null, '1', '1', '2026-03-30 23:20:55', '2026-03-30 23:20:59', null, '', '', '0', '', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('411', '2', 'title', '文章标题', 'varchar(255)', '1', '1', '2', '2', '2', '1', 'eq', null, '2', null, '1', '1', '2026-03-30 23:20:55', '2026-03-30 23:20:59', null, '', '', '0', '', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('412', '2', 'author', '文章作者', 'varchar(255)', '1', '1', '2', '2', '2', '1', 'eq', null, '3', null, '1', '1', '2026-03-30 23:20:55', '2026-03-30 23:20:59', null, '', '', '0', '', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('413', '2', 'image', '文章图片', 'varchar(1000)', '1', '1', '2', '2', '2', '1', 'eq', null, '4', null, '1', '1', '2026-03-30 23:20:55', '2026-03-30 23:20:59', null, '', '', '0', '', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('414', '2', 'describe', '文章简介', 'varchar(1000)', '1', '1', '2', '2', '2', '1', 'eq', null, '5', null, '1', '1', '2026-03-30 23:20:55', '2026-03-30 23:20:59', null, '', '', '0', '', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('415', '2', 'content', '文章内容', 'text', '1', '1', '2', '2', '2', '1', 'eq', null, '6', null, '1', '1', '2026-03-30 23:20:55', '2026-03-30 23:20:59', null, '', '', '0', '', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('416', '2', 'views', '浏览次数', 'int(11)', '1', '1', '2', '2', '2', '1', 'eq', null, '7', null, '1', '1', '2026-03-30 23:20:55', '2026-03-30 23:20:59', null, '', '', '0', '', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('417', '2', 'sort', '排序', 'int(10) unsigned', '1', '1', '2', '2', '2', '1', 'eq', null, '8', null, '1', '1', '2026-03-30 23:20:55', '2026-03-30 23:20:59', null, '', '', '0', '', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('418', '2', 'status', '状态', 'tinyint(1) unsigned', '1', '1', '2', '2', '2', '1', 'eq', null, '9', null, '1', '1', '2026-03-30 23:20:55', '2026-03-30 23:20:59', null, '', '', '0', '', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('419', '2', 'is_link', '是否外链', 'tinyint(1)', '1', '1', '2', '2', '2', '1', 'eq', null, '10', null, '1', '1', '2026-03-30 23:20:55', '2026-03-30 23:20:59', null, '', '', '0', '', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('420', '2', 'link_url', '链接地址', 'varchar(255)', '1', '1', '2', '2', '2', '1', 'eq', null, '11', null, '1', '1', '2026-03-30 23:20:55', '2026-03-30 23:20:59', null, '', '', '0', '', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('421', '2', 'is_hot', '是否热门', 'tinyint(1) unsigned', '1', '1', '2', '2', '2', '1', 'eq', null, '12', null, '1', '1', '2026-03-30 23:20:55', '2026-03-30 23:20:59', null, '', '', '0', '', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('422', '2', 'created_by', '创建者', 'int(11)', '1', '1', '1', '1', '1', '1', 'eq', null, '13', null, '1', '1', '2026-03-30 23:20:55', '2026-03-30 23:20:59', null, '', '', '0', '', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('423', '2', 'updated_by', '更新者', 'int(11)', '1', '1', '1', '1', '1', '1', 'eq', null, '14', null, '1', '1', '2026-03-30 23:20:55', '2026-03-30 23:20:59', null, '', '', '0', '', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('424', '2', 'create_time', '创建时间', 'datetime', '1', '1', '1', '1', '1', '1', 'eq', null, '15', null, '1', '1', '2026-03-30 23:20:55', '2026-03-30 23:20:59', null, '', '', '0', '', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('425', '2', 'update_time', '修改时间', 'datetime', '1', '1', '1', '1', '1', '1', 'eq', null, '16', null, '1', '1', '2026-03-30 23:20:55', '2026-03-30 23:20:59', null, '', '', '0', '', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('426', '2', 'delete_time', '删除时间', 'datetime', '1', '1', '1', '1', '1', '1', 'eq', null, '17', null, '1', '1', '2026-03-30 23:20:55', '2026-03-30 23:20:59', null, '', '', '0', '', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('451', '3', 'id', '编号', 'int(11) unsigned', '2', '1', '1', '1', '2', '1', 'eq', null, '0', null, '1', '1', '2026-03-30 23:39:05', '2026-06-19 18:23:13', null, 'Number', 'id', '0', '', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('452', '3', 'parent_id', '父级ID', 'int(11)', '1', '1', '2', '2', '2', '2', 'eq', null, '1', null, '1', '1', '2026-03-30 23:39:05', '2026-06-19 18:23:13', null, 'Number', 'parentId', '0', 'textarea', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('453', '3', 'category_name', '分类标题', 'varchar(255)', '1', '1', '2', '2', '2', '2', 'like', null, '2', null, '1', '1', '2026-03-30 23:39:05', '2026-06-19 18:23:13', null, 'String', 'categoryName', '0', 'textarea', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('454', '3', 'describe', '分类简介', 'varchar(255)', '1', '1', '2', '2', '2', '1', 'eq', null, '3', null, '1', '1', '2026-03-30 23:39:05', '2026-06-19 18:23:13', null, 'String', 'describe', '0', 'textarea', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('455', '3', 'image', '分类图片', 'varchar(255)', '1', '1', '2', '2', '2', '1', 'eq', null, '4', null, '1', '1', '2026-03-30 23:39:05', '2026-06-19 18:23:13', null, 'String', 'image', '0', 'imageUpload', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('456', '3', 'sort', '排序', 'int(10) unsigned', '1', '1', '2', '2', '2', '1', 'eq', null, '5', null, '1', '1', '2026-03-30 23:39:05', '2026-06-19 18:23:13', null, 'Number', 'sort', '0', 'textarea', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('457', '3', 'status', '状态', 'tinyint(1) unsigned', '1', '1', '2', '2', '2', '1', 'eq', 'data_status', '6', null, '1', '1', '2026-03-30 23:39:05', '2026-06-19 18:23:13', null, 'Number', '', '0', 'radio', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('458', '3', 'created_by', '创建者', 'int(11)', '1', '1', '1', '1', '1', '1', 'eq', null, '7', null, '1', '1', '2026-03-30 23:39:05', '2026-06-19 18:23:13', null, '', '', '0', '', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('459', '3', 'updated_by', '更新者', 'int(11)', '1', '1', '1', '1', '1', '1', 'eq', null, '8', null, '1', '1', '2026-03-30 23:39:05', '2026-06-19 18:23:13', null, '', '', '0', '', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('460', '3', 'create_time', '创建时间', 'datetime', '1', '1', '1', '1', '1', '1', 'eq', null, '9', null, '1', '1', '2026-03-30 23:39:05', '2026-06-19 18:23:13', null, '', '', '0', '', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('461', '3', 'update_time', '修改时间', 'datetime', '1', '1', '1', '1', '1', '1', 'eq', null, '10', null, '1', '1', '2026-03-30 23:39:05', '2026-06-19 18:23:13', null, '', '', '0', '', null);
INSERT INTO `sa_tool_generate_columns` VALUES ('462', '3', 'delete_time', '删除时间', 'datetime', '1', '1', '1', '1', '1', '1', 'eq', null, '11', null, '1', '1', '2026-03-30 23:39:05', '2026-06-19 18:23:13', null, '', '', '0', '', null);

-- ----------------------------
-- Table structure for `sa_tool_generate_tables`
-- ----------------------------
DROP TABLE IF EXISTS `sa_tool_generate_tables`;
CREATE TABLE `sa_tool_generate_tables` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `table_name` varchar(200) DEFAULT NULL COMMENT '表名称',
  `table_comment` varchar(500) DEFAULT NULL COMMENT '表注释',
  `package_name` varchar(100) DEFAULT NULL COMMENT '控制器包名',
  `business_name` varchar(50) DEFAULT NULL COMMENT '业务名称',
  `class_name` varchar(50) DEFAULT NULL COMMENT '类名称',
  `tpl_category` varchar(100) DEFAULT NULL COMMENT '生成类型,single 单表CRUD,tree 树表CRUD,parent_sub父子表CRUD',
  `options` varchar(1500) DEFAULT NULL COMMENT '其他业务选项',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` int(11) DEFAULT NULL COMMENT '创建者',
  `updated_by` int(11) DEFAULT NULL COMMENT '更新者',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  `sub_table_name` varchar(64) DEFAULT NULL COMMENT '关联子表的表名',
  `sub_table_fk_name` varchar(64) DEFAULT NULL COMMENT '子表关联的外键名',
  `tpl_web_type` varchar(30) NOT NULL DEFAULT 'element-plus' COMMENT '前端模板类型（element-ui模版 element-plus模版）',
  `module_name` varchar(30) NOT NULL COMMENT '生成模块名',
  `function_name` varchar(50) NOT NULL COMMENT '生成功能名',
  `function_author` varchar(50) NOT NULL COMMENT '生成功能作者',
  `gen_type` tinyint(4) NOT NULL DEFAULT '0' COMMENT '生成代码方式（0zip压缩包 1自定义路径）',
  `gen_path` varchar(200) NOT NULL DEFAULT '/' COMMENT '生成路径（不填默认项目路径）',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC COMMENT='代码生成业务表';

-- ----------------------------
-- Records of sa_tool_generate_tables
-- ----------------------------
INSERT INTO `sa_tool_generate_tables` VALUES ('2', 'sa_article', '文章表', 'Article', 'article', 'Article', 'single', '{\"relations\":[],\"tree_id\":\"id\",\"tree_name\":\"category_name\",\"tree_parent_id\":\"category_id\"}', '', '1', '1', '2026-03-30 00:36:12', '2026-06-19 20:30:44', null, null, null, 'element-plus', '', '', 'FssAdminTest', '0', '/');
INSERT INTO `sa_tool_generate_tables` VALUES ('3', 'sa_article_category', '文章分类表', 'ArticleCategory', 'articleCategory', 'ArticleCategory', 'tree', '{\"relations\":[],\"tree_id\":\"id\",\"tree_parent_id\":\"category_id\",\"tree_name\":\"category_name\"}', '', '1', '1', '2026-03-30 22:33:53', '2026-06-19 18:23:13', null, null, null, 'element-plus', 'Category', '分类模块', 'FssAdmin', '0', '/');

-- ----------------------------
-- Table structure for `t_history_record`
-- ----------------------------
DROP TABLE IF EXISTS `t_history_record`;
CREATE TABLE `t_history_record` (
  `id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '主键id',
  `tenant_id` bigint(20) NOT NULL DEFAULT '0' COMMENT '租户ID',
  `source` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '历史记忆来源',
  `pattern` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '模式',
  `library` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '知识库编号',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '对话名',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `chat_model_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '会话级聊天模型ID',
  `embedding_model_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '会话级向量模型ID',
  PRIMARY KEY (`id`),
  KEY `idx_t_history_record_tenant_id` (`tenant_id`),
  KEY `idx_t_history_record_source` (`source`),
  KEY `idx_t_history_record_pattern` (`pattern`),
  KEY `idx_history_record_tenant_source_library` (`tenant_id`,`source`,`library`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='历史记录表';

-- ----------------------------
-- Records of t_history_record
-- ----------------------------

-- ----------------------------
-- Table structure for `t_memory_detail`
-- ----------------------------
DROP TABLE IF EXISTS `t_memory_detail`;
CREATE TABLE `t_memory_detail` (
  `id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '主键id',
  `tenant_id` bigint(20) NOT NULL DEFAULT '0' COMMENT '租户ID',
  `source_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '记录表ID',
  `type` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '内容类型（ai；user）',
  `content` longtext COLLATE utf8mb4_unicode_ci COMMENT '记忆内容',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_t_memory_detail_tenant_id` (`tenant_id`),
  KEY `idx_t_memory_detail_source_id` (`source_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='历史详情表';

-- ----------------------------
-- Records of t_memory_detail
-- ----------------------------

-- ----------------------------
-- Table structure for `t_system_document`
-- ----------------------------
DROP TABLE IF EXISTS `t_system_document`;
CREATE TABLE `t_system_document` (
  `id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '主键id',
  `tenant_id` bigint(20) NOT NULL DEFAULT '0' COMMENT '租户ID',
  `document_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '文档名',
  `document_type` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '文档类型',
  `document_size` int(11) NOT NULL DEFAULT '0' COMMENT '文档大小（MB）',
  `library_number` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '知识库编号',
  `document_summary` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '知识摘要',
  `upload_time` datetime DEFAULT NULL COMMENT '上传时间',
  `status` mediumint(5) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_t_system_document_tenant_id` (`tenant_id`),
  KEY `idx_t_system_document_library_number` (`library_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统文档附件表';

-- ----------------------------
-- Records of t_system_document
-- ----------------------------

-- ----------------------------
-- Table structure for `t_system_model`
-- ----------------------------
DROP TABLE IF EXISTS `t_system_model`;
CREATE TABLE `t_system_model` (
  `id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '主键id',
  `tenant_id` bigint(20) NOT NULL DEFAULT '0' COMMENT '租户ID',
  `model_name` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '模型名',
  `base_url` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '访问URL',
  `api_key` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ApiKey',
  `type` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '模型类型',
  `source` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '模型来源',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `display_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '展示名',
  `model_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '实际模型ID（请求时传给服务端）',
  PRIMARY KEY (`id`),
  KEY `idx_t_system_model_tenant_id` (`tenant_id`),
  KEY `idx_t_system_model_type` (`type`),
  KEY `idx_t_system_model_source` (`source`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='模型管理表';

-- ----------------------------
-- Records of t_system_model
-- ----------------------------

-- ----------------------------
-- Table structure for `t_system_setting`
-- ----------------------------
DROP TABLE IF EXISTS `t_system_setting`;
CREATE TABLE `t_system_setting` (
  `id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '主键id',
  `tenant_id` bigint(20) NOT NULL DEFAULT '0' COMMENT '租户ID',
  `source` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '配置项来源',
  `content` json DEFAULT NULL COMMENT '配置项内容',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_t_system_setting_tenant_id` (`tenant_id`),
  KEY `idx_t_system_setting_source` (`source`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表';

-- ----------------------------
-- Records of t_system_setting
-- ----------------------------
