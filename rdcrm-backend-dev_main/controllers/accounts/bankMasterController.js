import BankMaster from "../../models/accounts/bankMasterModel.js";
import BankTransaction from "../../models/accounts/bankTransactionModel.js";
import mongoose from "mongoose";

/**
 * Helper: mask account number — show only last 4 digits.
 * e.g. "123456789012" → "•••• •••• 1234"
 */
export const maskAccNo = (accNo) => {
  if (!accNo) return "—";
  const s = String(accNo).replace(/\s/g, "");
  if (s.length <= 4) return s;
  const last4 = s.slice(-4);
  return `•••• •••• ${last4}`;
};

/**
 * Helper: compute live balance for a bank account from transactions.
 */
export const computeBankBalance = async (bankId) => {
  const agg = await BankTransaction.aggregate([
    { $match: { bank_id: new mongoose.Types.ObjectId(bankId) } },
    {
      $group: {
        _id: "$type",
        total: { $sum: "$amount" },
      },
    },
  ]);
  let credits = 0, debits = 0;
  agg.forEach((r) => {
    if (r._id === "credit") credits = r.total;
    if (r._id === "debit") debits = r.total;
  });
  return Math.round((credits - debits) * 100) / 100;
};

// ── GET /accounts/bank-master ─────────────────────────────────────────────────
export const getBankAccounts = async (req, res) => {
  try {
    const banks = await BankMaster.find({ is_active: true }).sort({ createdAt: 1 }).lean();

    // Attach live balance + mask account number
    const result = await Promise.all(
      banks.map(async (b) => {
        const balance = await computeBankBalance(b._id);
        return {
          _id: b._id,
          bank_name: b.bank_name,
          account_holder: b.account_holder,
          account_number_masked: maskAccNo(b.account_number),
          // Last 4 digits for display label
          last4: String(b.account_number || "").slice(-4),
          ifsc_code: b.ifsc_code,
          account_type: b.account_type,
          branch: b.branch,
          is_active: b.is_active,
          balance,
          label: `${b.bank_name} ••••${String(b.account_number || "").slice(-4)}`,
          createdAt: b.createdAt,
        };
      })
    );

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("Error in getBankAccounts:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /accounts/bank-master/:id — full detail (for master edit only) ────────
export const getBankAccountById = async (req, res) => {
  try {
    const bank = await BankMaster.findById(req.params.id).lean();
    if (!bank) return res.status(404).json({ success: false, message: "Bank account not found" });
    const balance = await computeBankBalance(bank._id);
    const obTxn = await BankTransaction.findOne({ bank_id: bank._id, reference_type: "OpeningBalance" }).lean();
    return res.status(200).json({
      success: true,
      data: {
        ...bank,
        account_number_masked: maskAccNo(bank.account_number),
        balance,
        opening_balance: obTxn ? obTxn.amount : 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /accounts/bank-master — create ───────────────────────────────────────
export const createBankAccount = async (req, res) => {
  try {
    const { bank_name, account_holder, account_number, ifsc_code, account_type, branch, opening_balance } = req.body;
    if (!bank_name || !account_number) {
      return res.status(400).json({ success: false, message: "bank_name and account_number are required" });
    }

    // Prevent duplicate account numbers
    const existing = await BankMaster.findOne({ account_number: String(account_number).trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: "A bank account with this account number already exists" });
    }

    const bank = await BankMaster.create({
      bank_name: String(bank_name).trim(),
      account_holder: String(account_holder || "").trim(),
      account_number: String(account_number).trim(),
      ifsc_code: String(ifsc_code || "").trim().toUpperCase(),
      account_type: account_type || "Current",
      branch: String(branch || "").trim(),
      created_by: req.user?._id || null,
      created_by_name: req.user?.name || "",
    });

    let balance = 0;
    const initialAmount = Number(opening_balance);
    if (!isNaN(initialAmount) && initialAmount > 0) {
      await BankTransaction.create({
        bank_id: bank._id,
        bank_name: bank.bank_name,
        account_number_masked: maskAccNo(bank.account_number),
        type: "credit",
        amount: initialAmount,
        description: "Opening Balance",
        reference_type: "OpeningBalance",
        txn_date: new Date(),
        created_by: req.user?._id || null,
        created_by_name: req.user?.name || "",
      });
      balance = initialAmount;
    }

    return res.status(201).json({
      success: true,
      message: "Bank account created successfully",
      data: {
        _id: bank._id,
        bank_name: bank.bank_name,
        account_number_masked: maskAccNo(bank.account_number),
        last4: String(bank.account_number).slice(-4),
        label: `${bank.bank_name} ••••${String(bank.account_number).slice(-4)}`,
        balance,
      },
    });
  } catch (err) {
    console.error("Error in createBankAccount:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /accounts/bank-master/:id — update ────────────────────────────────────
export const updateBankAccount = async (req, res) => {
  try {
    const { bank_name, account_holder, account_number, ifsc_code, account_type, branch, is_active, opening_balance } = req.body;
    const bank = await BankMaster.findById(req.params.id);
    if (!bank) return res.status(404).json({ success: false, message: "Bank account not found" });

    if (bank_name !== undefined) bank.bank_name = String(bank_name).trim();
    if (account_holder !== undefined) bank.account_holder = String(account_holder).trim();
    if (account_number !== undefined) bank.account_number = String(account_number).trim();
    if (ifsc_code !== undefined) bank.ifsc_code = String(ifsc_code).trim().toUpperCase();
    if (account_type !== undefined) bank.account_type = account_type;
    if (branch !== undefined) bank.branch = String(branch).trim();
    if (is_active !== undefined) bank.is_active = Boolean(is_active);

    await bank.save();

    if (opening_balance !== undefined) {
      const val = parseFloat(opening_balance);
      const obTxn = await BankTransaction.findOne({ bank_id: bank._id, reference_type: "OpeningBalance" });
      if (obTxn) {
        if (val > 0) {
          obTxn.amount = val;
          await obTxn.save();
        } else {
          await obTxn.deleteOne();
        }
      } else if (val > 0) {
        await BankTransaction.create({
          bank_id: bank._id,
          bank_name: bank.bank_name,
          account_number_masked: maskAccNo(bank.account_number),
          type: "credit",
          amount: val,
          reference_type: "OpeningBalance",
          description: "Opening Balance",
          created_by: req.user?._id,
          created_by_name: req.user?.name,
        });
      }
    }

    const balance = await computeBankBalance(bank._id);

    return res.status(200).json({
      success: true,
      message: "Bank account updated",
      data: {
        _id: bank._id,
        bank_name: bank.bank_name,
        account_number_masked: maskAccNo(bank.account_number),
        last4: String(bank.account_number).slice(-4),
        label: `${bank.bank_name} ••••${String(bank.account_number).slice(-4)}`,
        balance,
        is_active: bank.is_active,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE /accounts/bank-master/:id — soft delete ───────────────────────────
export const deleteBankAccount = async (req, res) => {
  try {
    const bank = await BankMaster.findById(req.params.id);
    if (!bank) return res.status(404).json({ success: false, message: "Bank account not found" });
    bank.is_active = false;
    await bank.save();
    return res.status(200).json({ success: true, message: "Bank account deactivated" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /accounts/bank-master/:id/transactions — ledger ──────────────────────
export const getBankTransactions = async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = { bank_id: new mongoose.Types.ObjectId(req.params.id) };
    if (from || to) {
      filter.txn_date = {};
      if (from) filter.txn_date.$gte = new Date(from + "T00:00:00.000Z");
      if (to) filter.txn_date.$lte = new Date(to + "T23:59:59.999Z");
    }
    const txns = await BankTransaction.find(filter).sort({ txn_date: -1 }).lean();
    const balance = await computeBankBalance(req.params.id);
    return res.status(200).json({ success: true, data: txns, balance });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
