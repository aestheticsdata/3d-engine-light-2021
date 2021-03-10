import axios from 'axios';
import { useEffect, useState } from "react";
import { DataType } from "./DataType";


const JSONDataService = (url: string): DataType => {
  const [data, setData] = useState<DataType>({});

  useEffect(() => {
    getData().then(response => { setData(response.data) });
  }, []);

  const getData = async () => {
    return await axios.get(url);
  };

  return data;
}

export default JSONDataService;
