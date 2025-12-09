import { relations } from "drizzle-orm/relations";
import { users, issues, warehouses, items, auditLogs, notifications, issueActivities, locations, warehouseOperators } from "./schema";

export const issuesRelations = relations(issues, ({one, many}) => ({
	user_reportedBy: one(users, {
		fields: [issues.reportedBy],
		references: [users.id],
		relationName: "issues_reportedBy_users_id"
	}),
	user_assignedTo: one(users, {
		fields: [issues.assignedTo],
		references: [users.id],
		relationName: "issues_assignedTo_users_id"
	}),
	warehouse: one(warehouses, {
		fields: [issues.warehouseId],
		references: [warehouses.id]
	}),
	item: one(items, {
		fields: [issues.itemId],
		references: [items.id]
	}),
	user_closedBy: one(users, {
		fields: [issues.closedBy],
		references: [users.id],
		relationName: "issues_closedBy_users_id"
	}),
	user_reopenedBy: one(users, {
		fields: [issues.reopenedBy],
		references: [users.id],
		relationName: "issues_reopenedBy_users_id"
	}),
	issueActivities: many(issueActivities),
}));

export const usersRelations = relations(users, ({many}) => ({
	issues_reportedBy: many(issues, {
		relationName: "issues_reportedBy_users_id"
	}),
	issues_assignedTo: many(issues, {
		relationName: "issues_assignedTo_users_id"
	}),
	issues_closedBy: many(issues, {
		relationName: "issues_closedBy_users_id"
	}),
	issues_reopenedBy: many(issues, {
		relationName: "issues_reopenedBy_users_id"
	}),
	auditLogs: many(auditLogs),
	notifications_senderId: many(notifications, {
		relationName: "notifications_senderId_users_id"
	}),
	notifications_recipientId: many(notifications, {
		relationName: "notifications_recipientId_users_id"
	}),
	issueActivities: many(issueActivities),
	warehouses: many(warehouses),
	warehouseOperators: many(warehouseOperators),
}));

export const warehousesRelations = relations(warehouses, ({one, many}) => ({
	issues: many(issues),
	location: one(locations, {
		fields: [warehouses.locationId],
		references: [locations.id]
	}),
	user: one(users, {
		fields: [warehouses.managerId],
		references: [users.id]
	}),
	warehouseOperators: many(warehouseOperators),
}));

export const itemsRelations = relations(items, ({many}) => ({
	issues: many(issues),
}));

export const auditLogsRelations = relations(auditLogs, ({one}) => ({
	user: one(users, {
		fields: [auditLogs.userId],
		references: [users.id]
	}),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	user_senderId: one(users, {
		fields: [notifications.senderId],
		references: [users.id],
		relationName: "notifications_senderId_users_id"
	}),
	user_recipientId: one(users, {
		fields: [notifications.recipientId],
		references: [users.id],
		relationName: "notifications_recipientId_users_id"
	}),
}));

export const issueActivitiesRelations = relations(issueActivities, ({one}) => ({
	issue: one(issues, {
		fields: [issueActivities.issueId],
		references: [issues.id]
	}),
	user: one(users, {
		fields: [issueActivities.userId],
		references: [users.id]
	}),
}));

export const locationsRelations = relations(locations, ({many}) => ({
	warehouses: many(warehouses),
}));

export const warehouseOperatorsRelations = relations(warehouseOperators, ({one}) => ({
	user: one(users, {
		fields: [warehouseOperators.userId],
		references: [users.id]
	}),
	warehouse: one(warehouses, {
		fields: [warehouseOperators.warehouseId],
		references: [warehouses.id]
	}),
}));