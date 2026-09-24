// The decision detail route lives outside the (workspace) group on purpose:
// that group's loading.tsx wraps every page in a Suspense boundary, so a
// notFound() thrown inside it streams the not-found UI with HTTP 200. Here the
// page renders without a loading boundary and an unknown id is a real 404.
// The visual shell is identical; it reuses the workspace layout and error UI.
export { default } from "../(workspace)/layout";
