import React from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import Homepage from "../components/Homepage";

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`Easily handle images in your app - ${siteConfig.title}`}
      description="Description will go into a meta tag in <head />"
    >
      <Homepage />
    </Layout>
  );
}
