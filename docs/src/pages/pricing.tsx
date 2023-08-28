export default function Page() {
  // this page is only to prevent a build error
  // the actual pricing page will be displayed through the vercel rewrite settings

  // hard refresh the page to make sure the user is redirected to the correct page
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
  return null;
}
