// Max size of a learner's assignment upload. Shared by the server check
// (assignmentFiles.ts) and the browser check (PathwayViewer), so it must stay free
// of server-only imports.
export const MAX_ASSIGNMENT_FILE_MB = 3
export const MAX_ASSIGNMENT_FILE_BYTES = MAX_ASSIGNMENT_FILE_MB * 1024 * 1024
export const ASSIGNMENT_FILE_TOO_LARGE = `The file is larger than ${MAX_ASSIGNMENT_FILE_MB} MB. Please make it smaller, or paste a link to it instead.`
