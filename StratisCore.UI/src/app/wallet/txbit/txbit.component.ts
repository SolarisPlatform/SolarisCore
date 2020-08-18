import { Component } from '@angular/core';
import { FormGroup, Validators, FormBuilder, AbstractControl } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Router } from '@angular/router';


import { ApiService } from '../../shared/services/api.service';
import { GlobalService } from '../../shared/services/global.service';
import { ColdStakingService } from "../../shared/services/coldstaking.service";
import { ModalService } from '../../shared/services/modal.service';
import { WalletInfo } from '../../shared/models/wallet-info';
import { SignMessageRequest } from '../../shared/models/wallet-signmessagerequest';

import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'txbit',
  templateUrl: './txbit.component.html',
  styleUrls: ['./txbit.component.css'],
})

export class TxbitComponent {
  constructor(
    private apiService: ApiService,
    private stakeService: ColdStakingService,
    private globalService: GlobalService,
    private modalService: NgbModal,
    private genericModalService: ModalService,
    private router: Router,
    private fb: FormBuilder
  ) {
    this.buildLinkForm();
  }
  public coldStakingAccount: string = "coldStakingColdAddresses";
  public linkForm: FormGroup;
  public allAddresses: any;
  public showUnusedAddresses: boolean = false;
  public childWindow = null;

  public getAllAddresses() {
    this.getAddresses();
  }

  public onShowUnusedAddressedChanged(checkbox) {
    this.showUnusedAddresses = checkbox.checked;
    this.getAddresses();
  }

  public onLinkButtonClick(button) {
    button.disabled = true;
    this.linkAddress(button);
  }

  ngOnInit() {
    this.getAddresses();
  }

  ngOnDestroy() {

  }

  private linkAddress(button) {
    const walletName = this.globalService.getWalletName();
    const message = this.linkForm.get("address").value;
    const address = this.allAddresses.filter(a => a.value === this.linkForm.get("address").value)[0];
    const password = this.linkForm.get("password").value;

    const accountName = (address.isColdStaking) ? this.coldStakingAccount : "account 0";

    const signMessageRequest = new SignMessageRequest(walletName, accountName, password, address.value, message);

    this.apiService.signMessage(signMessageRequest)
      .subscribe(
        response => {
          button.disabled = false;
          const electron = require('electron');
          const BrowserWindow = electron.remote.BrowserWindow;
          this.childWindow = new BrowserWindow({
            width: 1150,
            height: 650,
            frame: true,
            minWidth: 1150,
            minHeight: 650,
            title: "Solaris Core",
            webPreferences: {
              webSecurity: false,
              nodeIntegration: false
            }
          });
          this.childWindow.on('closed', () => {
            this.childWindow = null;
          });
          this.childWindow.loadURL(`https://localhost:44348/Login/?s=${encodeURIComponent(response)}&a=${encodeURIComponent(address.value)}`);
        }
      );
  }

  private setAddresses(addresses: any, isColdStaking: boolean) {
    for (const address of addresses) {
      if (((!address.isUsed && this.showUnusedAddresses) || address.isUsed) && (!address.isChange)) {

        let key = `${address.address}`;
        key += (isColdStaking) ? " (cold staking)" : "";

        const value = address.address;

        this.allAddresses.push({
          key: key,
          value: value,
          isColdStaking: isColdStaking
        });
      }
    }
  }
  private getAddresses() {
    const walletInfo = new WalletInfo(this.globalService.getWalletName());

    this.allAddresses = [];

    const getInfoSubscription = this.stakeService.getInfo(walletInfo.walletName).subscribe(walletInfoResponse => {
      this.apiService.getAllAddresses(walletInfo).subscribe(response => this.setAddresses(response.addresses, false));

      if (walletInfoResponse.coldWalletAccountExists) {
        walletInfo.accountName = this.coldStakingAccount;
        this.apiService.getAllAddresses(walletInfo).subscribe(response => this.setAddresses(response.addresses, true));
      }

      getInfoSubscription.unsubscribe();
    });
  }

  private buildLinkForm(): void {
    this.linkForm = this.fb.group({
      "address": ["", Validators.required],
      "password": ["", Validators.required]
    });

    this.linkForm.valueChanges.pipe(debounceTime(300))
      .subscribe(() => this.onLinkFormValueChanged());
  }

  onLinkFormValueChanged() {
    if (!this.linkForm) { return; }
    const form = this.linkForm;
    for (const field in this.linkFormErrors) {
      this.linkFormErrors[field] = '';
      const control = form.get(field);
      if (control && control.dirty && !control.valid) {
        const messages = this.linkValidationMessages[field];
        for (const key in control.errors) {
          this.linkFormErrors[field] += messages[key] + ' ';
        }
      }
    }
  }

  linkFormErrors = {
    "address": "",
    "password": ""
  };

  linkValidationMessages = {
    "address": {
      "required": "An address is required."
    },
    "password": {
      "required": "Your password is required."
    }
  };
}
