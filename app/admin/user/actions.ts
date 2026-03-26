"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "../../lib/prisma"
import { Division, JobTitle, Role } from "@prisma/client"
import * as xlsx from "xlsx"
import crypto from "crypto"
import bcrypt from "bcryptjs"
import { sendAccountActivation } from "../../lib/email"

const VALID_DIVISIONS = new Set(Object.values(Division))
const VALID_TITLES = new Set(Object.values(JobTitle))

export type UserFormData = {
  name: string
  email: string
  division: Division
  title: JobTitle
  officeId: string
  devManagerId: string
}

export async function createUser(data: UserFormData) {
  await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      division: data.division,
      title: data.title,
      officeId: data.officeId || null,
      devManagerId: data.devManagerId || null,
    },
  })
  revalidatePath("/admin/user")
}

export async function updateUser(id: string, data: UserFormData) {
  await prisma.user.update({
    where: { id },
    data: {
      name: data.name,
      email: data.email,
      division: data.division,
      title: data.title,
      officeId: data.officeId || null,
      devManagerId: data.devManagerId || null,
    },
  })
  revalidatePath("/admin/user")
}

export async function deleteUser(id: string) {
  await prisma.user.delete({ where: { id } })
  revalidatePath("/admin/user")
}

export type BulkImportResult = {
  created: number
  skipped: string[]
  errors: { row: number; message: string }[]
}

export async function bulkCreateUsers(formData: FormData): Promise<BulkImportResult> {
  const file = formData.get("file") as File | null
  if (!file) throw new Error("No file provided")

  const buffer = Buffer.from(await file.arrayBuffer())
  const wb = xlsx.read(buffer)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" })

  // Build email→id map for existing users (for duplicate check and dev manager lookup)
  const allUsers = await prisma.user.findMany({ select: { id: true, email: true } })
  const emailToId = new Map(
    allUsers.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u.id])
  )

  // Build cohort name→id map
  const allCohorts = await prisma.cohort.findMany({ where: { deletedAt: null }, select: { id: true, name: true } })
  const cohortNameToId = new Map(allCohorts.map((c) => [c.name.toLowerCase(), c.id]))

  // Build office name→id map
  const allOffices = await prisma.office.findMany({ select: { id: true, name: true } })
  const officeNameToId = new Map(allOffices.map((o) => [o.name.toLowerCase(), o.id]))

  const created: string[] = []
  const skipped: string[] = []
  const errors: { row: number; message: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // 1-indexed + skip header row

    const name = String(row["Name"] ?? "").trim()
    const email = String(row["Email"] ?? "").trim().toLowerCase()
    const divisionRaw = String(row["Division"] ?? "").trim().toUpperCase()
    const titleRaw = String(row["Title"] ?? "").trim().toUpperCase().replace(/ /g, "_")
    const officeName = String(row["Office"] ?? "").trim()
    const dmEmail = String(row["Dev Manager Email"] ?? "").trim().toLowerCase()
    const cohortName = String(row["Cohort Name"] ?? "").trim()

    // Validation
    if (!name) { errors.push({ row: rowNum, message: "Name is required" }); continue }
    if (!email) { errors.push({ row: rowNum, message: "Email is required" }); continue }
    if (!divisionRaw || !VALID_DIVISIONS.has(divisionRaw as Division)) {
      errors.push({ row: rowNum, message: `Invalid division "${divisionRaw}". See Valid Values sheet.` })
      continue
    }
    if (!titleRaw || !VALID_TITLES.has(titleRaw as JobTitle)) {
      errors.push({ row: rowNum, message: `Invalid title "${titleRaw}". See Valid Values sheet.` })
      continue
    }

    // Skip already-existing emails
    if (emailToId.has(email)) {
      skipped.push(email)
      continue
    }

    const devManagerId = dmEmail ? (emailToId.get(dmEmail) ?? null) : null

    const officeId = officeName ? (officeNameToId.get(officeName.toLowerCase()) ?? null) : null

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        division: divisionRaw as Division,
        title: titleRaw as JobTitle,
        officeId,
        devManagerId,
      },
    })

    // Assign cohort if provided
    if (cohortName) {
      const cohortId = cohortNameToId.get(cohortName.toLowerCase())
      if (cohortId) {
        await prisma.cohortUser.create({ data: { userId: newUser.id, cohortId } })
      }
      // Silently skip if cohort not found (not a fatal error)
    }

    // Track so duplicate rows in the same file are also caught
    emailToId.set(email, newUser.id)
    created.push(email)
  }

  revalidatePath("/admin/user")
  return { created: created.length, skipped, errors }
}

export async function setUserRoles(userId: string, roles: Role[]) {
  await prisma.userRole.deleteMany({ where: { userId } })
  if (roles.length > 0) {
    await prisma.userRole.createMany({
      data: roles.map((role) => ({ userId, role })),
    })
  }
  revalidatePath("/admin/user")
}

export async function sendActivationEmail(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
  if (!user?.email) throw new Error("User has no email")

  const token = crypto.randomBytes(32).toString("hex")
  const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours

  await prisma.user.update({
    where: { id: userId },
    data: { activationToken: token, activationTokenExpiry: expiry },
  })

  await sendAccountActivation(user.email, user.name ?? "there", token)
}

export async function adminSetPassword(userId: string, newPassword: string) {
  if (newPassword.length < 8) throw new Error("Password must be at least 8 characters")
  const hashed = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } })
  revalidatePath("/admin/user")
}

export async function setUserCohorts(userId: string, cohortIds: string[]) {
  await prisma.cohortUser.deleteMany({ where: { userId } })
  if (cohortIds.length > 0) {
    await prisma.cohortUser.createMany({
      data: cohortIds.map((cohortId) => ({ userId, cohortId })),
      skipDuplicates: true,
    })
  }
  revalidatePath("/admin/user")
  revalidatePath("/admin/cohort")
}
