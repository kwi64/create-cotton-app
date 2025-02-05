import styles from "./Home.module.css";

export default function IndexPage() {
  return (
    <div className={styles.container}>
      <div className={styles.logo}></div>
      <h1>CottonJS</h1>
      <p>
        Edit the <code>src/Home.tsx</code> file and save your changes. CottonJS
        will automatically reload the page for you!
      </p>
      <a href="https://cottonjs.com">Learn More</a>
    </div>
  );
}
