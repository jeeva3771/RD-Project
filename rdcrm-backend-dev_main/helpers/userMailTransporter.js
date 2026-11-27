import nodemailer from "nodemailer";
import mongoose from "mongoose";
import userModel from "../models/users/userModel.js";
import { transporter } from "./mail.js";

const emailSender = process.env.EMAIL_SENDER;

/**
 * Helper to verify if the user has Client Servicing Executive / Manager role.
 * Matches: "Client Servicing Executive", "Client Servicing Manager", etc.
 */
export const isClientServicingRole = async (user) => {
  let role = user?.role;
  if (role && typeof role === "object" && role.name) {
    return /client\s*servicing\s*(executive|manager)/i.test(role.name);
  }
  if (typeof role === "string" && !mongoose.Types.ObjectId.isValid(role)) {
    return /client\s*servicing\s*(executive|manager)/i.test(role);
  }
  const userId = user?._id || user?.id;
  if (userId) {
    try {
      const dbUser = await userModel.findById(userId).populate("role").lean();
      return /client\s*servicing\s*(executive|manager)/i.test(dbUser?.role?.name || "");
    } catch {
      return false;
    }
  }
  return false;
};

/**
 * Returns a transporter and from address for the given user if they are a
 * Client Servicing Executive or Client Servicing Manager and have configured
 * their personal email_app_password.
 *
 * For Admin, Accounts, Production, and all other roles, it STRICTLY uses the
 * system default transporter, even if an app password exists.
 */
export const getUserTransporter = async (user) => {
  // STRICT RULE: Only Client Servicing Executive and Client Servicing Manager can use personal mail
  const isCS = await isClientServicingRole(user);
  if (!isCS) {
    return {
      transporter,
      from: `"RD Custom Awards" <${emailSender || process.env.EMAIL_SENDER || "melroy@rdcustomawards.com"}>`,
      isCustomUser: false,
    };
  }

  let userEmail = user?.email;
  let userAppPassword = user?.email_app_password;
  let userName = user?.name;

  if ((!userAppPassword || !userEmail) && (user?._id || user?.id)) {
    try {
      const dbUser = await userModel
        .findById(user._id || user.id)
        .select("email email_app_password name")
        .lean();
      if (dbUser) {
        userEmail = dbUser.email || userEmail;
        userAppPassword = dbUser.email_app_password || userAppPassword;
        userName = dbUser.name || userName;
      }
    } catch (e) {
      console.warn("Could not fetch user for email transporter:", e?.message);
    }
  }

  if (userEmail && userAppPassword) {
    const customTransporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: userEmail,
        pass: userAppPassword,
      },
      tls: {
        rejectUnauthorized: false,
      },
      authMethod: "PLAIN",
    });

    return {
      transporter: customTransporter,
      from: `"${userName || "RD Custom Awards"}" <${userEmail}>`,
      isCustomUser: true,
    };
  }

  return {
    transporter,
    from: `"RD Custom Awards" <${emailSender || process.env.EMAIL_SENDER || "melroy@rdcustomawards.com"}>`,
    isCustomUser: false,
  };
};

/**
 * Sends an email using the logged-in user's credentials if available,
 * with automatic fallback to the default system transporter if custom credentials fail.
 */
export const sendMailWithUser = async (user, mailOptions) => {
  const { transporter: mailer, from, isCustomUser } = await getUserTransporter(user);
  const options = {
    from,
    ...mailOptions,
  };
  try {
    return await mailer.sendMail(options);
  } catch (err) {
    if (isCustomUser) {
      console.error(`Failed to send email via user SMTP (${from}):`, err?.message);
      console.log("Retrying with default system transporter...");
      return await transporter.sendMail({
        ...mailOptions,
        from: `"RD Custom Awards" <${emailSender || process.env.EMAIL_SENDER || "melroy@rdcustomawards.com"}>`,
      });
    }
    throw err;
  }
};
