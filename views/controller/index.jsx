import React from "react";
import BaseComponent from './../components/BaseComponent.jsx';
import Util from "../helpers/util";


export default class Index extends BaseComponent {
  render(){
    return (
      <div>
        <h1>已完成預算視覺化清單</h1>
        
        <ul>
          {this.props.budgets.map((b)=>
            <li><a href={Util.site_url(this.props.default_view+"/"+b.id)}>{b.title}</a></li>
          )}
        </ul>
        <div>
        </div>
      </div>
    );
  }
}

