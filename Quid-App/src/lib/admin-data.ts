import type { Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function getUserDataCounts(db: DbClient, userId: string) {
  const [
    accounts,
    subAccounts,
    transactions,
    budgets,
    debts,
    recurringPayments,
    payrollGroups,
    savingsGoals,
    cdts,
    vehicles,
    fuelLogs,
    maintenanceRecords,
    vehicleDocuments,
    vehicleReminders,
    medications,
    appointments,
    healthProfiles,
    pantryItems,
    shoppingLists,
    notifications,
    pushSubscriptions,
    backups,
    achievements,
  ] = await Promise.all([
    db.account.count({ where: { userId } }),
    db.subAccount.count({ where: { account: { userId } } }),
    db.transaction.count({ where: { userId } }),
    db.budget.count({ where: { userId } }),
    db.debt.count({ where: { userId } }),
    db.recurringPayment.count({ where: { userId } }),
    db.payrollGroup.count({ where: { userId } }),
    db.savingsGoal.count({ where: { userId } }),
    db.cDT.count({ where: { userId } }),
    db.vehicle.count({ where: { userId } }),
    db.fuelLog.count({ where: { vehicle: { userId } } }),
    db.maintenanceRecord.count({ where: { vehicle: { userId } } }),
    db.vehicleDocument.count({ where: { vehicle: { userId } } }),
    db.vehicleReminder.count({ where: { userId } }),
    db.medication.count({ where: { userId } }),
    db.medicalAppointment.count({ where: { userId } }),
    db.healthProfile.count({ where: { userId } }),
    db.pantryItem.count({ where: { userId } }),
    db.shoppingList.count({ where: { userId } }),
    db.appNotification.count({ where: { userId } }),
    db.pushSubscription.count({ where: { userId } }),
    db.storedBackup.count({ where: { userId } }),
    db.achievementProgress.count({ where: { userId } }),
  ]);

  return {
    accounts,
    subAccounts,
    transactions,
    budgets,
    debts,
    recurringPayments,
    payrollGroups,
    savingsGoals,
    cdts,
    vehicles,
    fuelLogs,
    maintenanceRecords,
    vehicleDocuments,
    vehicleReminders,
    medications,
    appointments,
    healthProfiles,
    pantryItems,
    shoppingLists,
    notifications,
    pushSubscriptions,
    backups,
    achievements,
    total:
      accounts +
      subAccounts +
      transactions +
      budgets +
      debts +
      recurringPayments +
      payrollGroups +
      savingsGoals +
      cdts +
      vehicles +
      fuelLogs +
      maintenanceRecords +
      vehicleDocuments +
      vehicleReminders +
      medications +
      appointments +
      healthProfiles +
      pantryItems +
      shoppingLists +
      notifications +
      pushSubscriptions +
      backups +
      achievements,
  };
}

export async function deleteUserCompletely(db: DbClient, userId: string) {
  await db.savingsContribution.deleteMany({ where: { goal: { userId } } });
  await db.savingsGoalAccount.deleteMany({ where: { goal: { userId } } });
  await db.cDT.deleteMany({ where: { userId } });
  await db.savingsGoal.deleteMany({ where: { userId } });

  await db.abonoDetail.deleteMany({ where: { abono: { userId } } });
  await db.abono.deleteMany({ where: { userId } });
  await db.installment.deleteMany({ where: { debt: { userId } } });
  await db.debt.deleteMany({ where: { userId } });

  await db.recurringPayment.deleteMany({ where: { payrollGroup: { userId } } });
  await db.payrollGroup.deleteMany({ where: { userId } });
  await db.recurringPayment.deleteMany({ where: { userId } });

  await db.transaction.deleteMany({ where: { userId } });
  await db.budget.deleteMany({ where: { userId } });

  await db.maintenanceItem.deleteMany({ where: { maintenanceRecord: { vehicle: { userId } } } });
  await db.fuelLog.deleteMany({ where: { vehicle: { userId } } });
  await db.maintenanceRecord.deleteMany({ where: { vehicle: { userId } } });
  await db.vehicleDocument.deleteMany({ where: { vehicle: { userId } } });
  await db.vehicleReminder.deleteMany({ where: { userId } });
  await db.fuelPrice.deleteMany({ where: { userId } });
  await db.vehicle.deleteMany({ where: { userId } });

  await db.medication.deleteMany({ where: { userId } });
  await db.medicalAppointment.deleteMany({ where: { userId } });
  await db.healthProfile.deleteMany({ where: { userId } });

  await db.shoppingListItem.deleteMany({ where: { shoppingList: { userId } } });
  await db.shoppingList.deleteMany({ where: { userId } });
  await db.pantryItem.deleteMany({ where: { userId } });

  await db.yieldRecord.deleteMany({ where: { account: { userId } } });
  await db.sharedAccountUser.deleteMany({ where: { userId } });
  await db.sharedAccountUser.deleteMany({ where: { account: { userId } } });
  await db.accountInvitation.deleteMany({ where: { OR: [{ inviterId: userId }, { inviteeId: userId }] } });
  await db.savingsGoalAccount.deleteMany({ where: { account: { userId } } });
  await db.subAccount.deleteMany({ where: { account: { userId } } });
  await db.account.deleteMany({ where: { userId } });

  await db.category.deleteMany({ where: { userId } });
  await db.appNotification.deleteMany({ where: { userId } });
  await db.pushSubscription.deleteMany({ where: { userId } });
  await db.storedBackup.deleteMany({ where: { userId } });
  await db.authCredential.deleteMany({ where: { userId } });
  await db.achievementProgress.deleteMany({ where: { userId } });
  await db.userSettings.deleteMany({ where: { userId } });
  await db.user.delete({ where: { id: userId } });
}
