async function main() {
  const url = "http://127.0.0.1:3000/api/nearby?lat=22.6100&lng=88.4050&radius=18";
  console.log("Fetching:", url);
  const res = await fetch(url, { headers: { Origin: "http://localhost:5000" } });
  console.log("HTTP Status:", res.status);
  const text = await res.text();
  console.log("Raw Response Text:", text);
  try {
    const data = JSON.parse(text);
    console.log("Total providers returned:", data.results?.length);
    console.log(JSON.stringify(data.results, null, 2));
  } catch (err) {
    console.error("JSON parse error:", err);
  }
}

main().catch(console.error);
